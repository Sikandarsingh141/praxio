import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, Model, Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { User } from '../users/schemas/user.schema';
import { formatUserName, userNameParts } from '../users/user-name';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateQuotationDto,
  CreateRepairRequestDto,
  CompleteRepairDto,
  CreateRepairReviewDto,
  CustomerRepairRequestListQueryDto,
  CustomerPickupVerificationDto,
  DeclineRepairRequestDto,
  QuotationListQueryDto,
  RepairRequestListQueryDto,
  ReadyForPickupDto,
  RepairProgressDto,
  ShopSearchDto,
  UpdateRepairRequestDto,
} from './customer-portal.dto';
import {
  LEGACY_REPAIR_JOB_STATUSES,
  REPAIR_JOB_STATUSES,
  RepairQuotation,
  RepairQuotationDocument,
  RepairReview,
  RepairReviewDocument,
  RepairRequest,
} from './repair-request.schema';

function mongoCustomerDisplayName(
  firstName: unknown,
  lastName: unknown,
  legacyName: unknown,
  fallback: string,
): Record<string, unknown> {
  const joined = {
    $trim: {
      input: {
        $concat: [
          { $ifNull: [firstName, ''] },
          ' ',
          { $ifNull: [lastName, ''] },
        ],
      },
    },
  };
  return {
    $let: {
      vars: { joined },
      in: {
        $cond: [
          { $ne: ['$$joined', ''] },
          '$$joined',
          { $ifNull: [legacyName, fallback] },
        ],
      },
    },
  };
}

export interface ShopSearchResult {
  id: string;
  shopName: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  services: string[];
  address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  location: { latitude: number; longitude: number } | null;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
  logoUrl: null;
  availability: 'unknown';
  phone: string | null;
  email: string;
}

function formatShopAddress(details?: User['shopDetails']): string {
  const seen = new Set<string>();
  return [
    details?.address,
    details?.street,
    details?.area,
    details?.city,
    details?.state,
    details?.postalCode,
    details?.country,
  ]
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');
}

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
  description?: string;
  polyline?: { encodedPolyline?: string };
}

interface GoogleDirectionsRoute {
  summary?: string;
  legs?: {
    distance?: { value?: number };
    duration?: { value?: number };
  }[];
  overview_polyline?: { points?: string };
}

interface ShopRepairRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  description: string;
  path: RouteCoordinate[];
}

function decodeGooglePolyline(encoded: string): RouteCoordinate[] {
  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const deltas: number[] = [];
    for (let axis = 0; axis < 2; axis += 1) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        if (index >= encoded.length || shift > 30) {
          throw new BadGatewayException(
            'The directions provider returned invalid route geometry.',
          );
        }
        byte = encoded.charCodeAt(index++) - 63;
        if (byte < 0 || byte > 63) {
          throw new BadGatewayException(
            'The directions provider returned invalid route geometry.',
          );
        }
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
    }

    const latitudeDelta = deltas[0];
    const longitudeDelta = deltas[1];
    if (latitudeDelta === undefined || longitudeDelta === undefined) {
      throw new BadGatewayException(
        'The directions provider returned invalid route geometry.',
      );
    }
    latitude += latitudeDelta;
    longitude += longitudeDelta;
    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }
  return coordinates;
}

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RegistrationRequest.name)
    private readonly registrations: Model<RegistrationRequest>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(RepairQuotation.name)
    private readonly quotations: Model<RepairQuotation>,
    @InjectModel(RepairReview.name)
    private readonly reviews: Model<RepairReview>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getShopRatings(shopIds: Types.ObjectId[]) {
    if (!shopIds.length) {
      return new Map<string, { rating: number; reviewCount: number }>();
    }

    const reviewGroups = await this.reviews
      .aggregate<{
        _id: Types.ObjectId;
        averageRating: number;
        reviewCount: number;
      }>([
        { $match: { shopId: { $in: shopIds } } },
        {
          $group: {
            _id: '$shopId',
            averageRating: { $avg: '$overallRating' },
            reviewCount: { $sum: 1 },
          },
        },
      ])
      .exec();
    return new Map(
      reviewGroups.map((group) => [
        group._id.toString(),
        {
          rating: Math.round(group.averageRating * 100) / 100,
          reviewCount: group.reviewCount,
        },
      ]),
    );
  }

  async searchShops(input: ShopSearchDto): Promise<ShopSearchResult[]> {
    if (
      (input.latitude === undefined) !== (input.longitude === undefined) ||
      (input.maxDistanceKm !== undefined &&
        (input.latitude === undefined || input.longitude === undefined))
    ) {
      throw new BadRequestException(
        'Provide both coordinates to calculate a distance filter.',
      );
    }
    const query: Record<string, unknown> = {
      accountType: 'shop',
      accountStatus: 'active',
      $or: [
        { accountLifecycleStatus: 'active' },
        { accountLifecycleStatus: { $exists: false } },
      ],
    };
    if (input.service) {
      query['shopDetails.services'] = input.service;
    }

    const shops = await this.users
      .find(query)
      .select(
        'email countryCode mobileNumber shopDetails.shopName shopDetails.businessType shopDetails.description shopDetails.yearsOfExperience shopDetails.services shopDetails.address shopDetails.street shopDetails.area shopDetails.city shopDetails.state shopDetails.country shopDetails.postalCode shopDetails.location',
      )
      .lean()
      .exec();
    if (!shops.length) {
      return [];
    }

    const shopIds = shops.map((shop) => shop._id);
    const approved = await this.registrations
      .find({
        userId: { $in: shopIds },
        accountType: 'shop',
        registrationStatus: 'approved',
        paymentStatus: 'paid',
      })
      .select('userId')
      .lean()
      .exec();
    const approvedIds = new Set(
      approved.map((registration) => registration.userId.toString()),
    );
    const shopRatings = await this.getShopRatings(shopIds);

    const searchText =
      input.latitude === undefined
        ? input.query?.trim().toLocaleLowerCase()
        : undefined;
    const results = shops
      .filter((shop) => approvedIds.has(shop._id.toString()))
      .map((shop): ShopSearchResult => {
        const details = shop.shopDetails;
        const location = details?.location;
        const distanceKm =
          input.latitude !== undefined &&
          input.longitude !== undefined &&
          location
            ? this.distanceKm(
                input.latitude,
                input.longitude,
                location.latitude,
                location.longitude,
              )
            : null;
        return {
          id: shop._id.toString(),
          shopName: details?.shopName ?? '',
          businessType: details?.businessType ?? '',
          description: details?.description ?? '',
          yearsOfExperience: details?.yearsOfExperience ?? 0,
          services: details?.services ?? [],
          address: details?.address ?? '',
          street: details?.street ?? '',
          area: details?.area ?? '',
          city: details?.city ?? '',
          state: details?.state ?? '',
          country: details?.country ?? '',
          postalCode: details?.postalCode ?? '',
          location: location
            ? { latitude: location.latitude, longitude: location.longitude }
            : null,
          distanceKm,
          rating: shopRatings.get(shop._id.toString())?.rating ?? null,
          reviewCount: shopRatings.get(shop._id.toString())?.reviewCount ?? 0,
          logoUrl: null,
          availability: 'unknown',
          phone:
            shop.mobileNumber && shop.countryCode
              ? `${shop.countryCode} ${shop.mobileNumber}`
              : null,
          email: shop.email,
        };
      })
      .filter((shop) => {
        if (!searchText) {
          return true;
        }
        const searchableText = [
          shop.shopName,
          shop.businessType,
          shop.description,
          shop.address,
          shop.street,
          shop.area,
          shop.city,
          shop.state,
          shop.country,
          shop.postalCode,
          ...shop.services,
        ]
          .join(' ')
          .toLocaleLowerCase();
        return searchText
          .split(/[\s,]+/)
          .filter(Boolean)
          .every((term) => searchableText.includes(term));
      })
      .filter(
        (shop) =>
          input.maxDistanceKm === undefined ||
          (shop.distanceKm !== null && shop.distanceKm <= input.maxDistanceKm),
      )
      .filter(
        (shop) =>
          input.minRating === undefined ||
          (shop.rating !== null && shop.rating >= input.minRating),
      );

    if (
      input.sort === 'nearest' ||
      (!input.sort && input.latitude !== undefined)
    ) {
      results.sort(
        (left, right) =>
          (left.distanceKm ?? Number.MAX_VALUE) -
          (right.distanceKm ?? Number.MAX_VALUE),
      );
    } else if (input.sort === 'rating') {
      results.sort(
        (left, right) =>
          (right.rating ?? -1) - (left.rating ?? -1) ||
          right.reviewCount - left.reviewCount ||
          left.shopName.localeCompare(right.shopName),
      );
    } else {
      const terms = searchText?.split(/[\s,]+/).filter(Boolean) ?? [];
      const score = (shop: ShopSearchResult) =>
        terms.reduce((total, term) => {
          const normalized = term.toLocaleLowerCase();
          return (
            total +
            (shop.shopName.toLocaleLowerCase().includes(normalized) ? 3 : 0) +
            (shop.services.some((service) =>
              service.toLocaleLowerCase().includes(normalized),
            )
              ? 2
              : 0) +
            (shop.city.toLocaleLowerCase().includes(normalized) ? 1 : 0)
          );
        }, 0);
      results.sort(
        (left, right) =>
          score(right) - score(left) ||
          left.shopName.localeCompare(right.shopName),
      );
    }
    return results;
  }

  async getShop(id: string): Promise<ShopSearchResult> {
    if (!isObjectIdOrHexString(id)) {
      throw new NotFoundException('Repair shop was not found');
    }
    const results = await this.searchShops({});
    const shop = results.find((result) => result.id === id);
    if (!shop) {
      throw new NotFoundException('Repair shop was not found');
    }
    return shop;
  }

  async searchAddresses(query: string): Promise<
    Array<{
      label: string;
      latitude: number;
      longitude: number;
      street?: string;
      area?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    }>
  > {
    const endpoint = this.config.get<string>(
      'GEOCODER_URL',
      'https://photon.komoot.io/api/',
    );
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new BadGatewayException(
        'Address suggestions are not configured correctly.',
      );
    }
    url.searchParams.set('q', query.trim());
    url.searchParams.set('limit', '6');
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'PraxioRepairDiscovery/1.0' },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new BadGatewayException(
        'Address suggestions are temporarily unavailable. Enter a search area manually.',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Address suggestions are temporarily unavailable. Enter a search area manually.',
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Address provider returned invalid results.',
      );
    }
    if (!payload || typeof payload !== 'object' || !('features' in payload)) {
      throw new BadGatewayException(
        'Address provider returned invalid results.',
      );
    }
    const features = payload.features;
    if (!Array.isArray(features)) {
      throw new BadGatewayException(
        'Address provider returned invalid results.',
      );
    }
    return features.flatMap((feature) => {
      if (!feature || typeof feature !== 'object') {
        return [];
      }
      const item = feature as {
        geometry?: { coordinates?: unknown };
        properties?: Record<string, unknown>;
      };
      const coordinates = item.geometry?.coordinates;
      if (
        !Array.isArray(coordinates) ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number'
      ) {
        return [];
      }
      const properties = item.properties ?? {};
      const property = (...keys: string[]): string | undefined => {
        for (const key of keys) {
          const value = properties[key];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
        return undefined;
      };
      const label = [
        property('name'),
        property('street'),
        property('district'),
        property('city'),
        property('state'),
        property('postcode'),
      ]
        .filter((part): part is string => !!part)
        .join(', ');
      if (!label) {
        return [];
      }
      const number = property('housenumber');
      const street = [number, property('street')].filter(Boolean).join(' ');
      return [
        {
          label,
          latitude: coordinates[1],
          longitude: coordinates[0],
          ...(street ? { street } : {}),
          ...(property('suburb', 'locality', 'district')
            ? { area: property('suburb', 'locality', 'district') }
            : {}),
          ...(property('city', 'locality', 'district')
            ? { city: property('city', 'locality', 'district') }
            : {}),
          ...(property('state') ? { state: property('state') } : {}),
          ...(property('country') ? { country: property('country') } : {}),
          ...(property('postcode') ? { postalCode: property('postcode') } : {}),
        },
      ];
    });
  }

  async createRepairRequest(
    customerId: string,
    input: CreateRepairRequestDto,
    photos: Array<{ mimeType: string; data: string }>,
  ): Promise<Omit<RepairRequest, 'photos'>> {
    const customer = await this.requireActiveCustomer(customerId);
    const shopIds = [...new Set(input.shopIds)];
    if (shopIds.length !== input.shopIds.length) {
      throw new BadRequestException('Select each repair shop only once.');
    }
    if (
      (input.customerLatitude === undefined) !==
      (input.customerLongitude === undefined)
    ) {
      throw new BadRequestException(
        'Provide both coordinates for the repair location.',
      );
    }
    const shops = await this.searchShops({});
    const visibleIds = new Set(shops.map((shop) => shop.id));
    if (!shopIds.every((id) => visibleIds.has(id))) {
      throw new BadRequestException(
        'One or more selected shops are no longer available.',
      );
    }
    const request = await this.repairRequests.create({
      customerId: customer._id,
      shopIds: shopIds.map((id) => new Types.ObjectId(id)),
      appliance: input.appliance.trim(),
      description: input.description.trim(),
      brand: input.brand?.trim(),
      model: input.model?.trim(),
      preferredServiceDate: input.preferredServiceDate
        ? new Date(input.preferredServiceDate)
        : undefined,
      serviceType: input.serviceType,
      customerLatitude: input.customerLatitude ?? customer.location?.latitude,
      customerLongitude:
        input.customerLongitude ?? customer.location?.longitude,
      photos,
      shopResponses: shopIds.map((shopId) => ({
        shopId: new Types.ObjectId(shopId),
        status: 'new',
      })),
    });
    await this.notifications.notifyUsers(
      shopIds.map((shopId) => new Types.ObjectId(shopId)),
      {
        title: 'New Repair Request Received',
        message: `${formatUserName(customer) || 'A customer'} submitted a ${input.appliance.trim()} repair request. Request ID: ${request._id.toString()}.`,
        type: 'new_repair_request',
        relatedEntityId: request._id,
        relatedEntityType: 'repair_request',
        link: `/shop/repair-requests/${request._id.toString()}`,
      },
    );
    const safeRequest = request.toObject();
    safeRequest.photos = [];
    return safeRequest;
  }

  async updateRepairRequest(
    customerId: string,
    requestId: string,
    input: UpdateRepairRequestDto,
    photos: Array<{ mimeType: string; data: string }>,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found.');
    }

    const shopIds = [...new Set(input.shopIds)];
    if (shopIds.length !== input.shopIds.length) {
      throw new BadRequestException('Select each repair shop only once.');
    }
    if (shopIds.length < 1 || shopIds.length > 5) {
      throw new BadRequestException('Select between 1 and 5 repair shops.');
    }

    const shops = await this.searchShops({});
    const visibleIds = new Set(shops.map((shop) => shop.id));
    if (!shopIds.every((id) => visibleIds.has(id))) {
      throw new BadRequestException(
        'One or more selected shops are no longer available.',
      );
    }

    const hasQuotes = await this.quotations.exists({
      repairRequestId: new Types.ObjectId(requestId),
    });
    if (hasQuotes) {
      throw new ConflictException(
        'A request cannot be edited after a shop submits a quotation.',
      );
    }

    const update: Record<string, unknown> = {
      $set: {
        shopIds: shopIds.map((id) => new Types.ObjectId(id)),
        shopResponses: shopIds.map((id) => ({
          shopId: new Types.ObjectId(id),
          status: 'new',
        })),
        appliance: input.appliance.trim(),
        description: input.description.trim(),
        serviceType: input.serviceType,
      },
      $unset: {},
    };
    const setFields = update.$set as Record<string, unknown>;
    const unsetFields = update.$unset as Record<string, ''>;
    for (const field of ['brand', 'model'] as const) {
      const value = input[field]?.trim();
      if (value) {
        setFields[field] = value;
      } else {
        unsetFields[field] = '';
      }
    }
    if (input.preferredServiceDate) {
      setFields.preferredServiceDate = new Date(input.preferredServiceDate);
    } else {
      unsetFields.preferredServiceDate = '';
    }
    if (photos.length) {
      setFields.photos = photos;
    } else if (input.removeExistingPhotos) {
      setFields.photos = [];
    }

    const updated = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(requestId),
          customerId: customer._id,
          status: 'open',
          repairJob: { $exists: false },
          acceptedQuotationId: { $exists: false },
          shopResponses: {
            $not: {
              $elemMatch: {
                status: {
                  $in: [
                    'quotation_submitted',
                    'customer_accepted',
                    'customer_rejected',
                  ],
                },
              },
            },
          },
        },
        update,
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'This request can no longer be edited. Requests are editable only while open and before a shop submits a quotation.',
      );
    }

    await this.notifications.notifyUsers(
      shopIds.map((id) => new Types.ObjectId(id)),
      {
        title: 'Repair Request Updated',
        message: `${formatUserName(customer) || 'A customer'} updated a ${input.appliance.trim()} repair request. Please review the latest details.`,
        type: 'new_repair_request',
        relatedEntityId: updated._id,
        relatedEntityType: 'repair_request',
        link: `/shop/repair-requests/${updated._id.toString()}`,
      },
    );

    const safeRequest = updated.toObject();
    safeRequest.photos = [];
    return safeRequest;
  }

  async getMyRepairRequests(
    customerId: string,
    filters: CustomerRepairRequestListQueryDto = new CustomerRepairRequestListQueryDto(),
  ): Promise<unknown[]> {
    const customer = await this.requireActiveCustomer(customerId);
    this.validateDateRange(filters.from, filters.to);
    const requestFilter: Record<string, unknown> = {
      customerId: customer._id,
    };
    if (filters.status) requestFilter.status = filters.status;
    if (filters.repairStatus) {
      requestFilter['repairJob.status'] = filters.repairStatus;
    }
    if (filters.appliance?.trim()) {
      requestFilter.appliance = {
        $regex: this.escapeRegex(filters.appliance.trim()),
        $options: 'i',
      };
    }
    if (filters.from || filters.to) {
      requestFilter.createdAt = {
        ...(filters.from ? { $gte: new Date(filters.from) } : {}),
        ...(filters.to
          ? {
              $lte: new Date(new Date(filters.to).setHours(23, 59, 59, 999)),
            }
          : {}),
      };
    }
    const requests = await this.repairRequests
      .find(requestFilter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const shopIds = [
      ...new Set(requests.flatMap((request) => request.shopIds)),
    ];
    const shopRecords = await this.users
      .find({ _id: { $in: shopIds } })
      .select('shopDetails.shopName')
      .lean()
      .exec();
    const shopNames = new Map(
      shopRecords.map((shop) => [
        shop._id.toString(),
        shop.shopDetails?.shopName ?? 'Repair shop',
      ]),
    );
    return Promise.all(
      requests.map(async (request) => ({
        ...request,
        shops: request.shopIds.map((id) => {
          const response = request.shopResponses?.find(
            (item) => item.shopId.toString() === id.toString(),
          );
          return {
            id: id.toString(),
            name: shopNames.get(id.toString()) ?? 'Repair shop',
            responseStatus: response?.status,
            declineReason: response?.declineReason,
          };
        }),
        quotations: await this.quotations
          .find({ repairRequestId: request._id })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
      })),
    );
  }

  async getCustomerQuotations(
    customerId: string,
    filters: QuotationListQueryDto,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    this.validateQuotationFilters(filters);
    await this.expireQuotations();
    const requests = await this.repairRequests
      .find({ customerId: customer._id })
      .select(
        '_id appliance brand model description preferredServiceDate serviceType status repairJob.status createdAt',
      )
      .lean()
      .exec();
    const requestMap = new Map(
      requests.map((request) => [request._id.toString(), request]),
    );
    const requestIds = requests.map((request) => request._id);
    const rawQuotations = requestIds.length
      ? await this.quotations
          .find({
            repairRequestId: { $in: requestIds },
            ...(filters.quotationId
              ? { _id: new Types.ObjectId(filters.quotationId) }
              : {}),
          })
          .sort({ createdAt: -1 })
          .lean()
          .exec()
      : [];
    const shopIds = [...new Set(rawQuotations.map((quote) => quote.shopId))];
    const shops = shopIds.length
      ? await this.users
          .find({ _id: { $in: shopIds } })
          .select(
            'shopDetails.shopName shopDetails.address shopDetails.street shopDetails.area shopDetails.city shopDetails.state shopDetails.postalCode shopDetails.country shopDetails.location',
          )
          .lean()
          .exec()
      : [];
    const shopMap = new Map(shops.map((shop) => [shop._id.toString(), shop]));
    const shopRatings = await this.getShopRatings(shopIds);
    const allQuotations = rawQuotations.map((quote) => {
      const request = requestMap.get(quote.repairRequestId.toString());
      const shop = shopMap.get(quote.shopId.toString());
      const rating = shopRatings.get(quote.shopId.toString());
      return {
        ...quote,
        status: this.normalizeQuotationStatus(quote.status),
        repairRequest: request,
        shop: {
          id: quote.shopId.toString(),
          shopName: shop?.shopDetails?.shopName ?? 'Repair shop',
          address: formatShopAddress(shop?.shopDetails),
          location: shop?.shopDetails?.location ?? null,
          rating: rating?.rating ?? null,
          reviewCount: rating?.reviewCount ?? 0,
          logoUrl: null,
        },
      };
    });
    const summary = this.quotationSummary(allQuotations);
    const quotations = allQuotations.filter((quote) =>
      this.matchesQuotationFilters(quote, filters),
    );
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    this.sortQuotations(quotations, filters.sort);
    return {
      quotations: quotations.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: quotations.length,
      summary,
    };
  }

  async getShopQuotations(
    shopId: string,
    filters: QuotationListQueryDto,
  ): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    this.validateQuotationFilters(filters);
    await this.expireQuotations(shop._id);
    const rawQuotations = await this.quotations
      .find({
        shopId: shop._id,
        ...(filters.quotationId
          ? { _id: new Types.ObjectId(filters.quotationId) }
          : {}),
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const requestIds = [
      ...new Set(rawQuotations.map((quote) => quote.repairRequestId)),
    ];
    const requests = requestIds.length
      ? await this.repairRequests
          .find({ _id: { $in: requestIds }, shopIds: shop._id })
          .select(
            '_id customerId appliance brand model description preferredServiceDate serviceType createdAt',
          )
          .lean()
          .exec()
      : [];
    const requestMap = new Map(
      requests.map((request) => [request._id.toString(), request]),
    );
    const customerIds = [
      ...new Set(requests.map((request) => request.customerId)),
    ];
    const customers = customerIds.length
      ? await this.users
          .find({ _id: { $in: customerIds } })
          .select('firstName lastName fullName')
          .lean()
          .exec()
      : [];
    const customerMap = new Map(
      customers.map((customer) => [customer._id.toString(), customer]),
    );
    const allQuotations = rawQuotations
      .filter((quote) => requestMap.has(quote.repairRequestId.toString()))
      .map((quote) => {
        const request = requestMap.get(quote.repairRequestId.toString());
        return {
          ...quote,
          status: this.normalizeQuotationStatus(quote.status),
          repairRequest: request,
          customer: {
            ...userNameParts(
              customerMap.get(request!.customerId.toString()) ?? {},
            ),
            displayName:
              formatUserName(
                customerMap.get(request!.customerId.toString()) ?? {},
              ) || 'Customer',
          },
          shop: {
            id: shop._id.toString(),
            shopName: shop.shopDetails?.shopName ?? 'Repair shop',
          },
        };
      });
    const summary = this.quotationSummary(allQuotations);
    const quotations = allQuotations.filter((quote) =>
      this.matchesQuotationFilters(quote, filters),
    );
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    this.sortQuotations(quotations, filters.sort);
    return {
      quotations: quotations.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: quotations.length,
      summary,
    };
  }

  async getShopDashboardOverview(
    shopId: string,
    filters: { from?: string; to?: string } = {},
  ): Promise<Record<string, unknown>> {
    const shop = await this.requireApprovedShop(shopId);
    await this.expireQuotations(shop._id);
    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;
    if (
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime())) ||
      (from && to && from > to)
    ) {
      throw new BadRequestException('The dashboard date range is invalid.');
    }
    if (from && to && to.getTime() - from.getTime() > 366 * 86400000) {
      throw new BadRequestException(
        'Dashboard date range cannot exceed 366 days.',
      );
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? '')) {
      to.setUTCHours(23, 59, 59, 999);
    }
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lte = to;
    const dateMatch = Object.keys(createdAt).length ? { createdAt } : {};

    const [requestFacets, repairFacets, quotationFacets, reviewFacets] =
      await Promise.all([
        this.repairRequests
          .aggregate<Record<string, unknown>>([
            { $match: { shopIds: shop._id, ...dateMatch } },
            {
              $set: {
                shopResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$shopResponses', []] },
                        as: 'response',
                        cond: { $eq: ['$$response.shopId', shop._id] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
            { $match: { shopResponse: { $exists: true } } },
            {
              $facet: {
                statuses: [
                  {
                    $group: { _id: '$shopResponse.status', count: { $sum: 1 } },
                  },
                ],
                recent: [
                  { $sort: { createdAt: -1 } },
                  { $limit: 5 },
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'customerId',
                      foreignField: '_id',
                      pipeline: [
                        { $project: { firstName: 1, lastName: 1, fullName: 1 } },
                      ],
                      as: 'customer',
                    },
                  },
                  {
                    $unwind: {
                      path: '$customer',
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      appliance: 1,
                      brand: 1,
                      model: 1,
                      description: 1,
                      createdAt: 1,
                      customerLatitude: 1,
                      customerLongitude: 1,
                      shopResponse: 1,
                      repairJob: { status: '$repairJob.status' },
                      customer: {
                        firstName: '$customer.firstName',
                        lastName: '$customer.lastName',
                        displayName: mongoCustomerDisplayName(
                          '$customer.firstName',
                          '$customer.lastName',
                          '$customer.fullName',
                          'Customer',
                        ),
                      },
                    },
                  },
                ],
              },
            },
          ])
          .exec(),
        this.repairRequests
          .aggregate<Record<string, unknown>>([
            {
              $match: {
                shopIds: shop._id,
                ...dateMatch,
                'repairJob.status': { $exists: true },
              },
            },
            {
              $lookup: {
                from: 'repair_quotations',
                localField: 'repairJob.acceptedQuotationId',
                foreignField: '_id',
                pipeline: [
                  { $match: { shopId: shop._id, status: 'accepted' } },
                  { $project: { amount: 1, currency: 1 } },
                ],
                as: 'acceptedQuotation',
              },
            },
            { $match: { 'acceptedQuotation.0': { $exists: true } } },
            {
              $facet: {
                statuses: [
                  { $group: { _id: '$repairJob.status', count: { $sum: 1 } } },
                ],
                active: [
                  {
                    $match: {
                      'repairJob.status': {
                        $nin: ['completed', 'repair_declined'],
                      },
                    },
                  },
                  { $sort: { updatedAt: -1 } },
                  { $limit: 5 },
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'customerId',
                      foreignField: '_id',
                      pipeline: [
                        { $project: { firstName: 1, lastName: 1, fullName: 1 } },
                      ],
                      as: 'customer',
                    },
                  },
                  {
                    $unwind: {
                      path: '$customer',
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      appliance: 1,
                      description: 1,
                      updatedAt: 1,
                      repairJob: { status: '$repairJob.status' },
                      customer: {
                        firstName: '$customer.firstName',
                        lastName: '$customer.lastName',
                        displayName: mongoCustomerDisplayName(
                          '$customer.firstName',
                          '$customer.lastName',
                          '$customer.fullName',
                          'Customer',
                        ),
                      },
                      acceptedQuotation: {
                        $arrayElemAt: ['$acceptedQuotation', 0],
                      },
                    },
                  },
                ],
                readyForPickup: [
                  { $match: { 'repairJob.status': 'ready_for_pickup' } },
                  { $count: 'count' },
                ],
              },
            },
          ])
          .exec(),
        this.quotations
          .aggregate<Record<string, unknown>>([
            { $match: { shopId: shop._id, ...dateMatch } },
            {
              $facet: {
                statuses: [
                  {
                    $group: {
                      _id: {
                        $cond: [
                          { $in: ['$status', ['pending', 'sent']] },
                          'pending',
                          {
                            $cond: [
                              { $in: ['$status', ['rejected', 'declined']] },
                              'rejected',
                              '$status',
                            ],
                          },
                        ],
                      },
                      count: { $sum: 1 },
                    },
                  },
                ],
                submittedTrend: [
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$createdAt',
                          timezone: 'UTC',
                        },
                      },
                      count: { $sum: 1 },
                    },
                  },
                  { $sort: { _id: -1 } },
                  { $limit: 90 },
                  { $sort: { _id: 1 } },
                ],
                recent: [
                  { $sort: { createdAt: -1 } },
                  { $limit: 5 },
                  {
                    $lookup: {
                      from: 'repair_requests',
                      localField: 'repairRequestId',
                      foreignField: '_id',
                      pipeline: [
                        { $match: { shopIds: shop._id } },
                        {
                          $lookup: {
                            from: 'users',
                            localField: 'customerId',
                            foreignField: '_id',
                            pipeline: [
                              {
                                $project: {
                                  firstName: 1,
                                  lastName: 1,
                                  fullName: 1,
                                },
                              },
                            ],
                            as: 'customer',
                          },
                        },
                        {
                          $unwind: {
                            path: '$customer',
                            preserveNullAndEmptyArrays: true,
                          },
                        },
                        {
                          $project: {
                            appliance: 1,
                            customer: {
                              firstName: '$customer.firstName',
                              lastName: '$customer.lastName',
                              displayName: mongoCustomerDisplayName(
                                '$customer.firstName',
                                '$customer.lastName',
                                '$customer.fullName',
                                'Customer',
                              ),
                            },
                          },
                        },
                      ],
                      as: 'repairRequest',
                    },
                  },
                  { $unwind: '$repairRequest' },
                  {
                    $project: {
                      _id: 1,
                      repairRequestId: 1,
                      amount: 1,
                      currency: 1,
                      status: 1,
                      createdAt: 1,
                      validUntil: 1,
                      customerName: mongoCustomerDisplayName(
                        '$repairRequest.customer.firstName',
                        '$repairRequest.customer.lastName',
                        '$repairRequest.customer.fullName',
                        'Customer',
                      ),
                      appliance: '$repairRequest.appliance',
                    },
                  },
                ],
              },
            },
          ])
          .exec(),
        this.reviews
          .aggregate<Record<string, unknown>>([
            { $match: { shopId: shop._id, ...dateMatch } },
            {
              $facet: {
                summary: [
                  {
                    $group: {
                      _id: null,
                      averageRating: { $avg: '$overallRating' },
                      total: { $sum: 1 },
                      fiveStar: {
                        $sum: { $cond: [{ $eq: ['$overallRating', 5] }, 1, 0] },
                      },
                    },
                  },
                ],
                distribution: [
                  { $group: { _id: '$overallRating', count: { $sum: 1 } } },
                ],
                recent: [
                  { $sort: { createdAt: -1 } },
                  { $limit: 3 },
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'customerId',
                      foreignField: '_id',
                      pipeline: [
                        { $project: { firstName: 1, lastName: 1, fullName: 1 } },
                      ],
                      as: 'customer',
                    },
                  },
                  {
                    $unwind: {
                      path: '$customer',
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      repairRequestId: 1,
                      overallRating: 1,
                      title: 1,
                      reviewText: 1,
                      createdAt: 1,
                      customerName: mongoCustomerDisplayName(
                        '$customer.firstName',
                        '$customer.lastName',
                        '$customer.fullName',
                        'Customer',
                      ),
                    },
                  },
                ],
              },
            },
          ])
          .exec(),
      ]);

    const requestData = requestFacets[0] ?? {};
    const repairData = repairFacets[0] ?? {};
    const quotationData = quotationFacets[0] ?? {};
    const reviewData = reviewFacets[0] ?? {};
    const requestCounts = this.statusCounts(requestData.statuses);
    const repairCounts = this.statusCounts(repairData.statuses);
    const quotationCounts = this.statusCounts(quotationData.statuses);
    const reviewSummary = Array.isArray(reviewData.summary)
      ? (reviewData.summary[0] as Record<string, unknown> | undefined)
      : undefined;
    const distribution = Array.isArray(reviewData.distribution)
      ? (reviewData.distribution as Array<{ _id: number; count: number }>)
      : [];
    const repairStatuses = [
      ...REPAIR_JOB_STATUSES,
      ...LEGACY_REPAIR_JOB_STATUSES,
    ];
    const quotationStatuses = [
      'pending',
      'accepted',
      'rejected',
      'expired',
      'withdrawn',
    ];
    const requestStatuses = [
      'new',
      'pending',
      'quotation_submitted',
      'customer_accepted',
      'customer_rejected',
      'declined',
      'expired',
    ];
    const itemCount = (value: unknown): number =>
      Array.isArray(value) && value[0] && typeof value[0] === 'object'
        ? Number((value[0] as { count?: number }).count ?? 0)
        : 0;

    return {
      range: { from: from ?? null, to: to ?? null },
      requests: {
        total: requestStatuses.reduce(
          (sum, status) => sum + (requestCounts[status] ?? 0),
          0,
        ),
        new: requestCounts.new ?? 0,
        pending: requestCounts.pending ?? 0,
        submitted: requestCounts.quotation_submitted ?? 0,
        accepted: requestCounts.customer_accepted ?? 0,
        declined:
          (requestCounts.declined ?? 0) +
          (requestCounts.customer_rejected ?? 0),
        expired: requestCounts.expired ?? 0,
        recent: requestData.recent ?? [],
      },
      quotations: {
        total: quotationStatuses.reduce(
          (sum, status) => sum + (quotationCounts[status] ?? 0),
          0,
        ),
        ...Object.fromEntries(
          quotationStatuses.map((status) => [
            status,
            quotationCounts[status] ?? 0,
          ]),
        ),
        trend: quotationData.submittedTrend ?? [],
        recent: quotationData.recent ?? [],
      },
      repairs: {
        total: repairStatuses.reduce(
          (sum, status) => sum + (repairCounts[status] ?? 0),
          0,
        ),
        ...Object.fromEntries(
          repairStatuses.map((status) => [status, repairCounts[status] ?? 0]),
        ),
        active: repairStatuses
          .filter(
            (status) => !['completed', 'repair_declined'].includes(status),
          )
          .reduce((sum, status) => sum + (repairCounts[status] ?? 0), 0),
        readyForPickup: itemCount(repairData.readyForPickup),
        recent: repairData.active ?? [],
      },
      reviews: {
        averageRating:
          typeof reviewSummary?.averageRating === 'number'
            ? Math.round(reviewSummary.averageRating * 100) / 100
            : null,
        total: Number(reviewSummary?.total ?? 0),
        fiveStar: Number(reviewSummary?.fiveStar ?? 0),
        distribution: [1, 2, 3, 4, 5].map((rating) => ({
          rating,
          count: distribution.find((entry) => entry._id === rating)?.count ?? 0,
        })),
        recent: reviewData.recent ?? [],
      },
      revenue: {
        available: false,
        reason: 'Repair payment and settlement records are not configured.',
      },
    };
  }

  private statusCounts(value: unknown): Record<string, number> {
    if (!Array.isArray(value)) return {};
    return Object.fromEntries(
      value
        .filter(
          (item): item is { _id: string; count: number } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { _id?: unknown })._id === 'string',
        )
        .map((item) => [item._id, item.count]),
    );
  }

  async getShopRepairRequests(
    shopId: string,
    filters: RepairRequestListQueryDto = new RepairRequestListQueryDto(),
  ): Promise<{
    requests: unknown[];
    page: number;
    limit: number;
    total: number;
    summary: Record<string, number>;
  }> {
    const shop = await this.requireApprovedShop(shopId);
    this.validateDateRange(filters.from, filters.to);
    const now = new Date();
    await this.repairRequests
      .updateMany(
        {
          shopIds: shop._id,
          shopResponses: {
            $elemMatch: {
              shopId: shop._id,
              status: { $in: ['new', 'pending'] },
              responseDeadline: { $lte: now },
            },
          },
        },
        {
          $set: {
            'shopResponses.$[response].status': 'expired',
            'shopResponses.$[response].respondedAt': now,
          },
        },
        {
          arrayFilters: [
            {
              'response.shopId': shop._id,
              'response.status': { $in: ['new', 'pending'] },
              'response.responseDeadline': { $lte: now },
            },
          ],
        },
      )
      .exec();
    let rawRequests = await this.repairRequests
      .find({ shopIds: shop._id })
      .sort({ createdAt: filters.sort === 'oldest' ? 1 : -1 })
      .lean()
      .exec();
    const requestsWithoutShopResponse = rawRequests.filter(
      (request) =>
        !request.shopResponses?.some(
          (response) => response.shopId.toString() === shop._id.toString(),
        ),
    );
    if (requestsWithoutShopResponse.length) {
      await Promise.all(
        requestsWithoutShopResponse.map((request) =>
          this.initializeShopResponse(request._id, shop._id),
        ),
      );
      rawRequests = await this.repairRequests
        .find({ shopIds: shop._id })
        .sort({ createdAt: filters.sort === 'oldest' ? 1 : -1 })
        .lean()
        .exec();
    }
    const customerIds = [
      ...new Set(rawRequests.map((request) => request.customerId)),
    ];
    const customers = await this.users
      .find({ _id: { $in: customerIds } })
      .select('firstName lastName fullName location')
      .lean()
      .exec();
    const customerMap = new Map(
      customers.map((customer) => [customer._id.toString(), customer]),
    );
    const matching = rawRequests.filter((request) => {
      const response = request.shopResponses?.find(
        (item) => item.shopId.toString() === shop._id.toString(),
      );
      if (!response) {
        return false;
      }
      const status = response.status;
      const statusMatches =
        !filters.status ||
        filters.status === 'all' ||
        (filters.status === 'accepted' &&
          ['quotation_submitted', 'customer_accepted'].includes(status)) ||
        (filters.status === 'declined' && status === 'declined') ||
        (filters.status === 'expired' && status === 'expired') ||
        status === filters.status;
      if (!statusMatches) {
        return false;
      }
      if (
        filters.repairStatus &&
        request.repairJob?.status !== filters.repairStatus
      ) {
        return false;
      }
      const createdAt = new Date(request.createdAt);
      if (filters.from && createdAt < new Date(filters.from)) {
        return false;
      }
      if (filters.to) {
        const endDate = new Date(filters.to);
        endDate.setHours(23, 59, 59, 999);
        if (createdAt > endDate) return false;
      }
      if (
        filters.appliance &&
        !request.appliance
          .toLocaleLowerCase()
          .includes(filters.appliance.trim().toLocaleLowerCase())
      ) {
        return false;
      }
      const search = filters.search?.trim().toLocaleLowerCase();
      return (
        !search ||
        `${request._id.toString()} ${request.appliance} ${request.brand ?? ''} ${request.model ?? ''} ${request.description} ${formatUserName(customerMap.get(request.customerId.toString()) ?? {})}`
          .toLocaleLowerCase()
          .includes(search)
      );
    });
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const requests = matching
      .slice((page - 1) * limit, page * limit)
      .map((request) => {
        const safeRequest = {
          ...request,
          photos: [],
          shopResponses: [],
          repairJob: request.repairJob
            ? { status: request.repairJob.status }
            : undefined,
        };
        const customer = customerMap.get(request.customerId.toString());
        return {
          ...safeRequest,
          customer: {
            ...userNameParts(customer ?? {}),
            displayName: formatUserName(customer ?? {}) || 'Customer',
            location:
              request.customerLatitude !== undefined &&
              request.customerLongitude !== undefined
                ? {
                    latitude: request.customerLatitude,
                    longitude: request.customerLongitude,
                  }
                : (customer?.location ?? null),
          },
          shopResponse: request.shopResponses?.find(
            (item) => item.shopId.toString() === shop._id.toString(),
          ),
        };
      });
    const statuses = rawRequests.map(
      (request) =>
        request.shopResponses?.find(
          (item) => item.shopId.toString() === shop._id.toString(),
        )?.status,
    );
    return {
      requests,
      page,
      limit,
      total: matching.length,
      summary: {
        total: rawRequests.length,
        new: statuses.filter((status) => status === 'new').length,
        pending: statuses.filter((status) => status === 'pending').length,
        accepted: statuses.filter((status) =>
          ['quotation_submitted', 'customer_accepted'].includes(status ?? ''),
        ).length,
        declined: statuses.filter((status) => status === 'declined').length,
        expired: statuses.filter((status) => status === 'expired').length,
      },
    };
  }

  async getShopRepairRequest(
    shopId: string,
    requestId: string,
  ): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    let request = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .lean()
      .exec();
    if (!request) {
      throw new NotFoundException('Repair request was not found');
    }
    let shopResponse = request.shopResponses?.find(
      (response) => response.shopId.toString() === shop._id.toString(),
    );
    if (!shopResponse) {
      await this.initializeShopResponse(request._id, shop._id);
      request = await this.repairRequests
        .findOne({ _id: requestId, shopIds: shop._id })
        .lean()
        .exec();
      shopResponse = request?.shopResponses?.find(
        (response) => response.shopId.toString() === shop._id.toString(),
      );
      if (!request || !shopResponse) {
        throw new NotFoundException('Repair request was not found');
      }
    }
    if (
      ['new', 'pending'].includes(shopResponse.status) &&
      shopResponse.responseDeadline &&
      shopResponse.responseDeadline <= new Date()
    ) {
      await this.repairRequests
        .updateOne(
          {
            _id: request._id,
            shopResponses: {
              $elemMatch: {
                shopId: shop._id,
                status: { $in: ['new', 'pending'] },
                responseDeadline: { $lte: new Date() },
              },
            },
          },
          {
            $set: {
              'shopResponses.$[response].status': 'expired',
              'shopResponses.$[response].respondedAt': new Date(),
            },
          },
          {
            arrayFilters: [
              {
                'response.shopId': shop._id,
                'response.status': { $in: ['new', 'pending'] },
                'response.responseDeadline': { $lte: new Date() },
              },
            ],
          },
        )
        .exec();
      shopResponse.status = 'expired';
    }
    const customer = await this.users
      .findById(request.customerId)
      .select('firstName lastName fullName email countryCode mobileNumber location')
      .lean()
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer account was not found');
    }
    const quotations = await this.quotations
      .find({ repairRequestId: request._id, shopId: shop._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const acceptedByThisShop = quotations.some(
      (quotation) =>
        quotation.status === 'accepted' &&
        quotation._id.toString() === request.acceptedQuotationId?.toString(),
    );
    const { repairJob, ...safeRequest } = request;
    return {
      ...safeRequest,
      ...(acceptedByThisShop && repairJob ? { repairJob } : {}),
      customer: {
        ...userNameParts(customer),
        displayName: formatUserName(customer) || 'Customer',
        email: customer.email,
        phone:
          customer.countryCode && customer.mobileNumber
            ? `${customer.countryCode} ${customer.mobileNumber}`
            : null,
        location:
          request.customerLatitude !== undefined &&
          request.customerLongitude !== undefined
            ? {
                latitude: request.customerLatitude,
                longitude: request.customerLongitude,
              }
            : (customer.location ?? null),
      },
      shopResponse,
      quotations,
    };
  }

  async declineRepairRequest(
    shopId: string,
    requestId: string,
    input: DeclineRepairRequestDto,
  ): Promise<void> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const now = new Date();
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('A decline reason is required.');
    }
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          status: 'open',
          shopResponses: {
            $elemMatch: {
              shopId: shop._id,
              status: { $in: ['new', 'pending'] },
              $or: [
                { responseDeadline: { $exists: false } },
                { responseDeadline: { $gt: now } },
              ],
            },
          },
        },
        {
          $set: {
            'shopResponses.$[response].status': 'declined',
            'shopResponses.$[response].declineReason': reason,
            'shopResponses.$[response].respondedAt': now,
          },
        },
        {
          new: true,
          arrayFilters: [
            {
              'response.shopId': shop._id,
              'response.status': { $in: ['new', 'pending'] },
              $or: [
                { 'response.responseDeadline': { $exists: false } },
                { 'response.responseDeadline': { $gt: now } },
              ],
            },
          ],
        },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This request is no longer available for a response.',
      );
    }
    await this.notifications.notifyUsers([request.customerId], {
      title: 'Repair Request Declined',
      message: `${shop.shopDetails?.shopName ?? 'A repair shop'} declined your ${request.appliance} request. Reason: ${reason}`,
      type: 'repair_request_declined',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: '/customer/repair-requests',
    });
  }

  async createQuotation(
    shopId: string,
    requestId: string,
    input: CreateQuotationDto,
  ): Promise<RepairQuotation> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id, status: 'open' })
      .exec();
    if (!request) {
      throw new NotFoundException('Repair request was not found');
    }
    const existingQuotation = await this.quotations
      .findOne({ repairRequestId: request._id, shopId: shop._id })
      .exec();
    if (existingQuotation) {
      await this.synchronizeShopResponseFromQuotation(
        request._id,
        shop._id,
        existingQuotation,
      );
      return existingQuotation;
    }
    const validUntil = input.validUntil
      ? new Date(input.validUntil)
      : undefined;
    if (validUntil && !Number.isFinite(validUntil.getTime())) {
      throw new BadRequestException('Quotation expiry date is invalid.');
    }
    if (validUntil && validUntil <= new Date()) {
      throw new BadRequestException('Quotation expiry must be in the future.');
    }
    const charges = [
      input.inspectionCharge,
      input.partsCost,
      input.labourCharge,
      input.additionalCharges,
    ];
    if (
      charges.some((charge) => charge !== undefined) &&
      Math.abs(
        charges.reduce<number>((total, charge) => total + (charge ?? 0), 0) -
          input.amount,
      ) > 0.01
    ) {
      throw new BadRequestException(
        'Quotation amount must equal the submitted charge breakdown.',
      );
    }
    const now = new Date();
    const updatedRequest = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: request._id,
          shopIds: shop._id,
          status: 'open',
          shopResponses: {
            $elemMatch: {
              shopId: shop._id,
              status: { $in: ['new', 'pending'] },
              $or: [
                { responseDeadline: { $exists: false } },
                { responseDeadline: { $gt: now } },
              ],
            },
          },
        },
        {
          $set: {
            'shopResponses.$.status': 'quotation_submitted',
            'shopResponses.$.respondedAt': now,
          },
        },
        { new: true },
      )
      .exec();
    if (!updatedRequest) {
      throw new ConflictException(
        'This request is no longer available for a quotation.',
      );
    }

    let quotation: RepairQuotationDocument | undefined;
    try {
      quotation = await this.quotations.create({
        repairRequestId: request._id,
        shopId: shop._id,
        amount: input.amount,
        currency: input.currency.trim().toUpperCase(),
        message: input.message.trim(),
        estimatedDays: input.estimatedDays,
        inspectionCharge: input.inspectionCharge,
        partsCost: input.partsCost,
        labourCharge: input.labourCharge,
        additionalCharges: input.additionalCharges,
        proposedSolution: input.proposedSolution?.trim(),
        warrantyInformation: input.warrantyInformation?.trim(),
        additionalNotes: input.additionalNotes?.trim(),
        validUntil,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const duplicateQuotation = await this.quotations
          .findOne({ repairRequestId: request._id, shopId: shop._id })
          .exec();
        if (duplicateQuotation) {
          await this.synchronizeShopResponseFromQuotation(
            request._id,
            shop._id,
            duplicateQuotation,
          );
          return duplicateQuotation;
        }
        throw new ConflictException(
          'A quotation has already been submitted for this request.',
        );
      }
      await this.repairRequests
        .updateOne(
          {
            _id: request._id,
            shopResponses: {
              $elemMatch: {
                shopId: shop._id,
                status: 'quotation_submitted',
                respondedAt: now,
              },
            },
          },
          {
            $set: { 'shopResponses.$.status': 'new' },
            $unset: { 'shopResponses.$.respondedAt': '' },
          },
        )
        .exec();
      throw error;
    }
    await this.notifications.notifyUsers([request.customerId], {
      title: 'New Repair Quotation',
      message: `${shop.shopDetails?.shopName ?? 'A repair shop'} submitted a quotation for your ${request.appliance} request.`,
      type: 'new_repair_quotation',
      relatedEntityId: quotation._id,
      relatedEntityType: 'repair_quotation',
      link: `/customer/quotations?quotationId=${quotation._id.toString()}`,
    });
    return quotation;
  }

  async updateQuotationStatus(
    customerId: string,
    quotationId: string,
    status: 'accepted' | 'declined',
    rejectionReason?: string,
  ): Promise<RepairQuotation> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(quotationId)) {
      throw new NotFoundException('Quotation was not found');
    }
    const quotation = await this.quotations.findById(quotationId).exec();
    if (!quotation) {
      throw new NotFoundException('Quotation was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: quotation.repairRequestId, customerId: customer._id })
      .exec();
    if (!request) {
      throw new NotFoundException('Quotation was not found');
    }
    const now = new Date();
    if (quotation.status === 'accepted' || request.acceptedQuotationId) {
      throw new ConflictException(
        'A quotation has already been accepted for this repair request.',
      );
    }
    if (
      !['pending', 'sent'].includes(quotation.status) ||
      (quotation.validUntil && quotation.validUntil <= now)
    ) {
      if (
        ['pending', 'sent'].includes(quotation.status) &&
        quotation.validUntil &&
        quotation.validUntil <= now
      ) {
        await this.expireQuotation(quotation);
      }
      throw new ConflictException(
        'This quotation is no longer available for a response.',
      );
    }

    let updated: RepairQuotationDocument | null = null;
    if (status === 'accepted') {
      const claimedRequest = await this.repairRequests
        .findOneAndUpdate(
          {
            _id: request._id,
            customerId: customer._id,
            status: 'open',
            acceptedQuotationId: { $exists: false },
          },
          {
            $set: {
              acceptedQuotationId: quotation._id,
              repairJob: {
                status: 'inspection_pending',
                acceptedQuotationId: quotation._id,
                confirmedAt: now,
                history: [
                  {
                    actorId: customer._id,
                    action: 'inspection_pending',
                    notes:
                      'Customer accepted the quotation. Shop inspection is required before repair.',
                    at: now,
                  },
                ],
              },
            },
          },
          { new: true },
        )
        .exec();
      if (!claimedRequest) {
        throw new ConflictException(
          'A quotation has already been accepted for this repair request.',
        );
      }
      updated = await this.quotations
        .findOneAndUpdate(
          {
            _id: quotation._id,
            status: { $in: ['pending', 'sent'] },
            $or: [
              { validUntil: { $exists: false } },
              { validUntil: { $gt: now } },
            ],
          },
          { $set: { status: 'accepted', respondedAt: now } },
          { new: true, runValidators: true },
        )
        .exec();
      if (!updated) {
        await this.repairRequests
          .updateOne(
            { _id: request._id, acceptedQuotationId: quotation._id },
            { $unset: { acceptedQuotationId: '' } },
          )
          .exec();
        throw new ConflictException(
          'This quotation is no longer available for a response.',
        );
      }
    } else {
      const reason = rejectionReason?.trim();
      updated = await this.quotations
        .findOneAndUpdate(
          {
            _id: quotation._id,
            status: { $in: ['pending', 'sent'] },
            $or: [
              { validUntil: { $exists: false } },
              { validUntil: { $gt: now } },
            ],
          },
          {
            $set: {
              status: 'rejected',
              respondedAt: now,
              ...(reason ? { rejectionReason: reason } : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .exec();
      if (!updated) {
        throw new ConflictException(
          'This quotation has already been answered.',
        );
      }
    }
    const responseStatus =
      status === 'accepted' ? 'customer_accepted' : 'customer_rejected';
    await this.repairRequests
      .updateOne(
        {
          _id: request._id,
          shopResponses: {
            $elemMatch: {
              shopId: quotation.shopId,
              status: 'quotation_submitted',
            },
          },
        },
        {
          $set: {
            'shopResponses.$[response].status': responseStatus,
            'shopResponses.$[response].respondedAt': now,
          },
        },
        {
          arrayFilters: [
            {
              'response.shopId': quotation.shopId,
              'response.status': 'quotation_submitted',
            },
          ],
        },
      )
      .exec();
    if (status === 'accepted') {
      const competing = await this.quotations
        .find({
          repairRequestId: request._id,
          _id: { $ne: quotation._id },
          status: { $in: ['pending', 'sent'] },
        })
        .select('_id shopId')
        .lean()
        .exec();
      if (competing.length) {
        await this.quotations
          .updateMany(
            {
              repairRequestId: request._id,
              _id: { $ne: quotation._id },
              status: { $in: ['pending', 'sent'] },
            },
            {
              $set: {
                status: 'rejected',
                respondedAt: now,
                rejectionReason:
                  'Another quotation was accepted for this repair request.',
              },
            },
          )
          .exec();
        await Promise.all(
          competing.map((competitor) =>
            this.notifications.notifyUsers([competitor.shopId], {
              title: 'Quotation No Longer Available',
              message: `Another shop's quotation was accepted for the ${request.appliance} repair request.`,
              type: 'customer_rejected_quotation',
              relatedEntityId: competitor._id,
              relatedEntityType: 'repair_quotation',
              link: `/shop/quotations?quotationId=${competitor._id.toString()}`,
            }),
          ),
        );
        await this.repairRequests
          .updateOne(
            { _id: request._id },
            {
              $set: {
                'shopResponses.$[response].status': 'customer_rejected',
                'shopResponses.$[response].respondedAt': now,
              },
            },
            {
              arrayFilters: [
                {
                  'response.shopId': {
                    $in: competing.map((competitor) => competitor.shopId),
                  },
                  'response.status': 'quotation_submitted',
                },
              ],
            },
          )
          .exec();
      }
    }
    await this.notifications.notifyUsers([quotation.shopId], {
      title:
        status === 'accepted'
          ? 'Customer Accepted Your Quotation'
          : 'Customer Declined Your Quotation',
      message: `The customer ${status === 'accepted' ? 'accepted' : 'rejected'} your quotation for ${request.appliance}.${status === 'declined' && rejectionReason?.trim() ? ` Reason: ${rejectionReason.trim()}` : ''}`,
      type:
        status === 'accepted'
          ? 'customer_accepted_quotation'
          : 'customer_rejected_quotation',
      relatedEntityId: quotation._id,
      relatedEntityType: 'repair_quotation',
      link: `/shop/quotations?quotationId=${quotation._id.toString()}`,
    });
    return updated;
  }

  async getCustomerRepairJob(
    customerId: string,
    requestId: string,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: requestId, customerId: customer._id })
      .lean()
      .exec();
    if (!request) {
      throw new NotFoundException('Repair job was not found');
    }
    const quotation = request.acceptedQuotationId
      ? await this.quotations
          .findById(request.acceptedQuotationId)
          .lean()
          .exec()
      : null;
    const shop = quotation
      ? await this.users
          .findById(quotation.shopId)
          .select('shopDetails email countryCode mobileNumber')
          .lean()
          .exec()
      : null;
    const quotations = await this.quotations
      .find({ repairRequestId: request._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const shopIds = request.shopIds ?? [];
    const assignedShops = shopIds.length
      ? await this.users
          .find({ _id: { $in: shopIds } })
          .select('shopDetails.shopName')
          .lean()
          .exec()
      : [];
    const shopNameMap = new Map(
      assignedShops.map((assignedShop) => [
        assignedShop._id.toString(),
        assignedShop.shopDetails?.shopName ?? 'Repair shop',
      ]),
    );
    return {
      ...request,
      ...(request.repairJob
        ? {
            repairJob: {
              ...request.repairJob,
              additionalChargeRequests:
                request.repairJob.additionalChargeRequests?.filter(
                  (charge) => charge.status !== 'draft',
                ) ?? [],
            },
          }
        : {}),
      shops: shopIds.map((shopId) => {
        const response = request.shopResponses?.find(
          (item) => item.shopId.toString() === shopId.toString(),
        );
        return {
          id: shopId.toString(),
          name: shopNameMap.get(shopId.toString()) ?? 'Repair shop',
          responseStatus: response?.status,
          declineReason: response?.declineReason,
        };
      }),
      quotations,
      acceptedQuotation: quotation,
      shop: shop
        ? {
            id: shop._id.toString(),
            name: shop.shopDetails?.shopName ?? 'Repair shop',
            address: formatShopAddress(shop.shopDetails),
            phone:
              shop.countryCode && shop.mobileNumber
                ? `${shop.countryCode} ${shop.mobileNumber}`
                : null,
            email: shop.email,
          }
        : null,
      review: await this.reviews
        .findOne({ repairRequestId: request._id })
        .lean()
        .exec(),
    };
  }

  async startRepairInspection(
    shopId: string,
    requestId: string,
  ): Promise<unknown> {
    const shop = await this.requireAcceptedRepairShop(shopId, requestId);
    const assigned = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .select('acceptedQuotationId')
      .lean()
      .exec();
    if (
      !assigned?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: assigned.acceptedQuotationId,
        shopId: shop._id,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException('Repair request was not found');
    }

    const now = new Date();
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          acceptedQuotationId: assigned.acceptedQuotationId,
          'repairJob.status': { $in: ['confirmed', 'inspection_pending'] },
        },
        {
          $set: {
            'repairJob.status': 'inspection_in_progress',
            'repairJob.inspection.status': 'in_progress',
            'repairJob.inspectionStartedAt': now,
            'repairJob.inspectionStartedBy': shop._id,
          },
          $push: {
            'repairJob.history': {
              actorId: shop._id,
              action: 'inspection_started',
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'Inspection can only be started once for a confirmed repair.',
      );
    }

    await this.notifications.notifyUsers([request.customerId], {
      title: 'Device inspection started',
      message: `${shop.shopDetails?.shopName ?? 'The repair shop'} has started inspecting your ${request.appliance}.`,
      type: 'repair_inspection_started',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${request._id.toString()}`,
    });
    return request.repairJob;
  }

  async saveRepairInspection(
    shopId: string,
    requestId: string,
    input: import('./repair-workflow.dto').InspectionReportDto,
  ): Promise<unknown> {
    const shop = await this.requireAcceptedRepairShop(shopId, requestId);

    const parts = this.normalizeRepairParts(input.parts);
    const partsTotal = this.roundRepairAmount(
      parts.reduce((total, part) => total + part.total, 0),
    );
    const labourCharge = input.labourCharge ?? 0;
    const inspectionCharges = input.inspectionCharges ?? 0;
    const otherCharges = input.otherCharges ?? 0;
    const estimatedTotal = this.roundRepairAmount(
      partsTotal + labourCharge + inspectionCharges + otherCharges,
    );
    if (
      input.action === 'submit' &&
      (!input.identifiedProblem?.trim() ||
        !input.findings?.trim() ||
        !input.requiredRepairWork?.trim())
    ) {
      throw new BadRequestException(
        'Identified problem, inspection findings, and required repair work are required to submit.',
      );
    }
    if (input.action === 'submit' && estimatedTotal <= 0) {
      throw new BadRequestException(
        'The inspection estimate must be greater than zero.',
      );
    }

    const now = new Date();
    const inspectionStatus =
      input.action === 'submit' ? 'awaiting_approval' : 'draft';
    const inspection = {
      status: inspectionStatus,
      identifiedProblem: input.identifiedProblem?.trim(),
      findings: input.findings?.trim(),
      requiredRepairWork: input.requiredRepairWork?.trim(),
      parts,
      partsTotal,
      labourCharge,
      inspectionCharges,
      otherCharges,
      estimatedTotal,
      estimatedTimeValue: input.estimatedTimeValue,
      estimatedTimeUnit: input.estimatedTimeUnit,
      warranty: input.warranty?.trim(),
      ...(input.images === undefined
        ? {}
        : { images: this.validateRepairImages(input.images) }),
      message: input.message?.trim(),
      ...(input.action === 'submit'
        ? { submittedBy: shop._id, submittedAt: now }
        : {}),
    };
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          'repairJob.status': 'inspection_in_progress',
        },
        {
          $set: {
            'repairJob.inspection': inspection,
            ...(input.action === 'submit'
              ? { 'repairJob.status': 'awaiting_customer_approval' }
              : {}),
          },
          ...(input.action === 'submit'
            ? {
                $push: {
                  'repairJob.history': {
                    actorId: shop._id,
                    action: 'inspection_report_submitted',
                    at: now,
                  },
                },
              }
            : {}),
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'The inspection report cannot be changed in the repair’s current status.',
      );
    }

    if (input.action === 'submit') {
      await this.notifications.notifyUsers([request.customerId], {
        title: 'Your device inspection is complete',
        message:
          'The repair shop has submitted its diagnosis and estimated repair cost. Review the report and approve or decline the repair.',
        type: 'repair_inspection_submitted',
        relatedEntityId: request._id,
        relatedEntityType: 'repair_request',
        link: `/customer/repair-requests/${request._id.toString()}`,
      });
    }
    return request.repairJob;
  }

  async decideRepairInspection(
    customerId: string,
    requestId: string,
    decision: 'approve' | 'decline',
    reason?: string,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }

    const now = new Date();
    const approved = decision === 'approve';
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          customerId: customer._id,
          status: 'open',
          'repairJob.status': 'awaiting_customer_approval',
          'repairJob.inspection.status': 'awaiting_approval',
          'repairJob.inspection.estimatedTotal': { $gt: 0 },
        },
        {
          $set: {
            'repairJob.status': approved
              ? 'inspection_approved'
              : 'repair_declined',
            'repairJob.inspection.status': approved ? 'approved' : 'declined',
            'repairJob.inspection.decidedBy': customer._id,
            'repairJob.inspection.decidedAt': now,
            'repairJob.inspection.decisionReason': reason?.trim(),
            ...(approved
              ? {
                  'repairJob.approvedRepairAmount': (
                    await this.repairRequests
                      .findOne({
                        _id: requestId,
                        customerId: customer._id,
                      })
                      .select('repairJob.inspection.estimatedTotal')
                      .lean()
                      .exec()
                  )?.repairJob?.inspection?.estimatedTotal,
                  'repairJob.approvedAdditionalCharges': 0,
                }
              : { status: 'cancelled' }),
          },
          $push: {
            'repairJob.history': {
              actorId: customer._id,
              action: approved ? 'inspection_approved' : 'inspection_declined',
              notes: reason?.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This inspection report is no longer awaiting your decision.',
      );
    }

    const shopId = request.acceptedQuotationId
      ? await this.quotations
          .findById(request.acceptedQuotationId)
          .select('shopId')
          .lean()
          .exec()
          .then((quotation) => quotation?.shopId)
      : undefined;
    if (!shopId) {
      throw new NotFoundException(
        'The repair shop for this request was not found.',
      );
    }
    await this.notifications.notifyUsers([shopId], {
      title: approved
        ? 'Customer approved the repair estimate'
        : 'Customer declined the repair',
      message: approved
        ? `The customer approved the inspection estimate for ${request.appliance}. You can now start the repair.`
        : `The customer declined the inspection estimate for ${request.appliance}.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`,
      type: approved
        ? 'repair_inspection_approved'
        : 'repair_inspection_declined',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/shop/repair-requests/${request._id.toString()}`,
    });
    return request.repairJob;
  }

  async startApprovedRepair(
    shopId: string,
    requestId: string,
  ): Promise<unknown> {
    const shop = await this.requireAcceptedRepairShop(shopId, requestId);
    const now = new Date();
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          'repairJob.status': 'inspection_approved',
          'repairJob.inspection.status': 'approved',
          'repairJob.inspection.decidedBy': { $exists: true },
        },
        {
          $set: {
            'repairJob.status': 'in_progress',
            'repairJob.startedAt': now,
            'repairJob.repairStartedBy': shop._id,
          },
          $push: {
            'repairJob.history': {
              actorId: shop._id,
              action: 'repair_started',
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'Repair can only start after the customer approves the inspection estimate.',
      );
    }
    await this.notifications.notifyUsers([request.customerId], {
      title: 'Repair started',
      message: `${shop.shopDetails?.shopName ?? 'The repair shop'} has started repairing your ${request.appliance}.`,
      type: 'repair_started',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${request._id.toString()}`,
    });
    return request.repairJob;
  }

  async requestAdditionalCharges(
    shopId: string,
    requestId: string,
    input: import('./repair-workflow.dto').AdditionalChargeRequestDto,
  ): Promise<unknown> {
    const shop = await this.requireAcceptedRepairShop(shopId, requestId);
    if (input.draftId && !isObjectIdOrHexString(input.draftId)) {
      throw new NotFoundException(
        'The saved additional charge draft was not found',
      );
    }
    if (
      input.action === 'submit' &&
      (!input.issue?.trim() ||
        !input.reason?.trim() ||
        !input.repairDescription?.trim())
    ) {
      throw new BadRequestException(
        'Issue, reason for additional work, and repair description are required.',
      );
    }
    const parts = this.normalizeRepairParts(input.parts);
    const partsTotal = this.roundRepairAmount(
      parts.reduce((total, part) => total + part.total, 0),
    );
    const labourCharge = input.labourCharge ?? 0;
    const otherCharges = input.otherCharges ?? 0;
    const amount = this.roundRepairAmount(
      partsTotal + labourCharge + otherCharges,
    );
    if (input.action === 'submit' && amount <= 0) {
      throw new BadRequestException(
        'Additional charges must be greater than zero.',
      );
    }
    const now = new Date();
    const status = input.action === 'submit' ? 'pending' : 'draft';
    const charge = {
      status,
      issue: input.issue?.trim() ?? '',
      reason: input.reason?.trim() ?? '',
      repairDescription: input.repairDescription?.trim() ?? '',
      parts,
      partsTotal,
      labourCharge,
      otherCharges,
      amount,
      blocksRepair: input.blocksRepair ?? false,
      estimatedTimeValue: input.estimatedTimeValue,
      estimatedTimeUnit: input.estimatedTimeUnit,
      ...(input.images === undefined
        ? {}
        : { images: this.validateRepairImages(input.images) }),
      message: input.message?.trim(),
      shopId: shop._id,
      requestedAt: now,
    };
    const activeStatusFilter = { $in: ['in_progress', 'on_hold'] };
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          'repairJob.status': activeStatusFilter,
          ...(input.draftId
            ? {
                'repairJob.additionalChargeRequests': {
                  $elemMatch: {
                    _id: input.draftId,
                    shopId: shop._id,
                    status: 'draft',
                  },
                },
              }
            : {}),
        },
        input.draftId
          ? {
              $set: {
                ...Object.fromEntries(
                  Object.entries(charge).map(([key, value]) => [
                    `repairJob.additionalChargeRequests.$.${key}`,
                    value,
                  ]),
                ),
                ...(input.action === 'submit' && input.blocksRepair
                  ? { 'repairJob.status': 'on_hold' }
                  : {}),
              },
            }
          : {
              ...(input.action === 'submit' && input.blocksRepair
                ? { $set: { 'repairJob.status': 'on_hold' } }
                : {}),
              $push: {
                'repairJob.additionalChargeRequests': charge,
                ...(input.action === 'submit'
                  ? {
                      'repairJob.history': {
                        actorId: shop._id,
                        action: 'additional_charges_requested',
                        at: now,
                      },
                    }
                  : {}),
              },
            },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'Additional charges can only be requested while the repair is in progress or on hold.',
      );
    }
    const savedCharge = request.repairJob?.additionalChargeRequests?.find(
      (item) => item._id?.toString() === input.draftId,
    );
    if (input.action === 'submit') {
      await this.notifications.notifyUsers([request.customerId], {
        title: 'Additional repair charges requested',
        message: input.blocksRepair
          ? `The repair shop found an additional issue with your ${request.appliance} that requires work to pause. Review the additional work and cost before approving it.`
          : `The repair shop found an additional issue with your ${request.appliance}. Review the new repair work and cost before approving it.`,
        type: 'additional_charges_requested',
        relatedEntityId: request._id,
        relatedEntityType: 'repair_request',
        link: `/customer/repair-requests/${request._id.toString()}`,
      });
    }
    return savedCharge ?? request.repairJob?.additionalChargeRequests?.at(-1);
  }

  async decideAdditionalCharges(
    customerId: string,
    requestId: string,
    chargeId: string,
    decision: 'accept' | 'decline',
    reason?: string,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId) || !isObjectIdOrHexString(chargeId)) {
      throw new NotFoundException('Additional charge request was not found');
    }
    const accepted = decision === 'accept';
    const now = new Date();
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          customerId: customer._id,
          'repairJob.additionalChargeRequests': {
            $elemMatch: {
              _id: new Types.ObjectId(chargeId),
              status: 'pending',
            },
          },
        },
        {
          $set: {
            'repairJob.additionalChargeRequests.$.status': accepted
              ? 'accepted'
              : 'rejected',
            'repairJob.additionalChargeRequests.$.decisionReason':
              reason?.trim(),
            'repairJob.additionalChargeRequests.$.decidedAt': now,
          },
          ...(accepted
            ? {
                $inc: {
                  'repairJob.approvedAdditionalCharges': this.roundRepairAmount(
                    await this.getPendingAdditionalChargeAmount(
                      requestId,
                      chargeId,
                      customer._id,
                    ),
                  ),
                },
              }
            : {}),
          $push: {
            'repairJob.history': {
              actorId: customer._id,
              action: accepted
                ? 'additional_charges_approved'
                : 'additional_charges_declined',
              notes: reason?.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This additional charge request is no longer awaiting your decision.',
      );
    }
    const charge = request.repairJob?.additionalChargeRequests?.find(
      (item) => item._id?.toString() === chargeId,
    );
    if (!charge) {
      throw new NotFoundException('Additional charge request was not found');
    }
    await this.notifications.notifyUsers([charge.shopId], {
      title: accepted
        ? 'Customer approved additional charges'
        : 'Customer declined additional charges',
      message: accepted
        ? `The customer approved the additional work for ${request.appliance}.`
        : `The customer declined the additional work for ${request.appliance}.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`,
      type: accepted
        ? 'additional_charges_approved'
        : 'additional_charges_declined',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/shop/repair-requests/${request._id.toString()}`,
    });
    return charge;
  }

  private async requireAcceptedRepairShop(shopId: string, requestId: string) {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const assigned = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .select('acceptedQuotationId')
      .lean()
      .exec();
    if (
      !assigned?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: assigned.acceptedQuotationId,
        shopId: shop._id,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException('Repair request was not found');
    }
    return shop;
  }

  private normalizeRepairParts(
    parts?: ReadonlyArray<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>,
  ) {
    return (parts ?? []).map((part) => {
      const total = this.roundRepairAmount(part.quantity * part.unitPrice);
      return {
        name: part.name.trim(),
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        total,
      };
    });
  }

  private roundRepairAmount(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  private validateRepairImages(
    images?: ReadonlyArray<{ mimeType: string; data: string }>,
  ) {
    if (
      (images ?? []).reduce((total, image) => total + image.data.length, 0) >
      1_700_000
    ) {
      throw new BadRequestException(
        'Repair workflow images must total no more than 1.2 MB.',
      );
    }
    return (images ?? []).map((image) => {
      const expectedPrefix = `data:${image.mimeType};base64,`;
      if (!image.data.startsWith(expectedPrefix)) {
        throw new BadRequestException(
          'Inspection images must be valid base64 image data.',
        );
      }
      return { mimeType: image.mimeType, data: image.data };
    });
  }

  private async getPendingAdditionalChargeAmount(
    requestId: string,
    chargeId: string,
    customerId: Types.ObjectId,
  ): Promise<number> {
    const request = await this.repairRequests
      .findOne({
        _id: requestId,
        customerId,
        'repairJob.additionalChargeRequests._id': new Types.ObjectId(chargeId),
        'repairJob.additionalChargeRequests.status': 'pending',
      })
      .select('repairJob.additionalChargeRequests')
      .lean()
      .exec();
    const charge = request?.repairJob?.additionalChargeRequests?.find(
      (item) => item._id?.toString() === chargeId && item.status === 'pending',
    );
    if (!charge) {
      throw new ConflictException(
        'This additional charge request is no longer awaiting your decision.',
      );
    }
    return charge.amount;
  }

  async updateRepairProgress(
    shopId: string,
    requestId: string,
    action: 'start' | 'hold',
    input: RepairProgressDto,
  ): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    const assignedJob = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .select('acceptedQuotationId')
      .lean()
      .exec();
    if (
      !assignedJob?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: assignedJob.acceptedQuotationId,
        shopId: shop._id,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException('Repair job was not found');
    }
    const now = new Date();
    const expectedStatuses =
      action === 'start' ? ['inspection_approved', 'on_hold'] : ['in_progress'];
    const nextStatus = action === 'start' ? 'in_progress' : 'on_hold';
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          acceptedQuotationId: { $exists: true },
          'repairJob.status': { $in: expectedStatuses },
          ...(action === 'start'
            ? {
                'repairJob.additionalChargeRequests': {
                  $not: {
                    $elemMatch: { status: 'pending', blocksRepair: true },
                  },
                },
              }
            : {}),
        },
        {
          $set: {
            'repairJob.status': nextStatus,
            ...(action === 'start'
              ? {
                  'repairJob.startedAt': now,
                  'repairJob.repairStartedBy': shop._id,
                }
              : {}),
          },
          $push: {
            'repairJob.history': {
              actorId: shop._id,
              action: nextStatus,
              notes: input.notes?.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This repair job cannot be updated from its current status.',
      );
    }
    if (action === 'start') {
      await this.notifications.notifyUsers([request.customerId], {
        title: 'Repair Started',
        message: `${shop.shopDetails?.shopName ?? 'Your repair shop'} has started repairing your ${request.appliance}.`,
        type: 'repair_started',
        relatedEntityId: request._id,
        relatedEntityType: 'repair_request',
        link: `/customer/repair-requests/${request._id.toString()}`,
      });
    }
    return request.repairJob;
  }

  async completeRepair(
    shopId: string,
    requestId: string,
    input: CompleteRepairDto,
  ): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    const assignedJob = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .select('acceptedQuotationId')
      .lean()
      .exec();
    if (
      !assignedJob?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: assignedJob.acceptedQuotationId,
        shopId: shop._id,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException('Repair job was not found');
    }
    const now = new Date();
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          'repairJob.status': { $in: ['in_progress', 'on_hold'] },
        },
        {
          $set: {
            'repairJob.status': 'repair_completed',
            'repairJob.repairCompletedAt': now,
            'repairJob.completionDescription':
              input.completionDescription.trim(),
            'repairJob.workPerformed': input.workPerformed.trim(),
            'repairJob.partsReplaced': input.partsReplaced?.trim(),
            'repairJob.finalNotes': input.finalNotes?.trim(),
          },
          $push: {
            'repairJob.history': {
              actorId: shop._id,
              action: 'repair_completed',
              notes: input.completionDescription.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This repair job cannot be marked repaired from its current status.',
      );
    }
    await this.notifications.notifyUsers([request.customerId], {
      title: 'Repair Work Completed',
      message: `${shop.shopDetails?.shopName ?? 'Your repair shop'} has completed the repair of your ${request.appliance}. The shop will notify you when it is ready for pickup.`,
      type: 'repair_marked_complete',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${request._id.toString()}`,
    });
    return request.repairJob;
  }

  async markReadyForPickup(
    shopId: string,
    requestId: string,
    input: ReadyForPickupDto,
  ): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    const assignedJob = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .select('acceptedQuotationId')
      .lean()
      .exec();
    if (
      !assignedJob?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: assignedJob.acceptedQuotationId,
        shopId: shop._id,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException('Repair job was not found');
    }
    const now = new Date();
    const address = [
      shop.shopDetails?.address,
      shop.shopDetails?.area,
      shop.shopDetails?.city,
      shop.shopDetails?.state,
      shop.shopDetails?.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          shopIds: shop._id,
          'repairJob.status': 'repair_completed',
        },
        {
          $set: {
            'repairJob.status': 'ready_for_pickup',
            'repairJob.readyForPickupAt': now,
            'repairJob.pickupInstructions': input.pickupInstructions.trim(),
            'repairJob.pickupMessage': input.message?.trim(),
          },
          $push: {
            'repairJob.history': {
              actorId: shop._id,
              action: 'ready_for_pickup',
              notes: input.message?.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This repair is not ready to be marked for pickup.',
      );
    }
    await this.notifications.notifyUsers([request.customerId], {
      title: 'Your Item Is Ready for Pickup',
      message: `Good news! Your ${request.appliance} has been repaired and is ready for pickup at ${shop.shopDetails?.shopName ?? 'the repair shop'}${address ? `, ${address}` : ''}. ${input.message?.trim() || 'Please inspect your item before confirming receipt.'}`,
      type: 'repair_ready_for_pickup',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${request._id.toString()}`,
    });
    return request.repairJob;
  }

  async verifyCustomerPickup(
    customerId: string,
    requestId: string,
    input: CustomerPickupVerificationDto,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    if (!input.received) {
      throw new BadRequestException(
        'Contact the shop or report a collection issue; no pickup was recorded.',
      );
    }
    if (!input.inspected) {
      if (!input.issueDescription?.trim()) {
        throw new BadRequestException(
          'Describe the issue found during inspection.',
        );
      }
      return this.reportRepairIssue(
        customerId,
        requestId,
        input.issueDescription,
      );
    }
    const now = new Date();
    const request = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: requestId,
          customerId: customer._id,
          'repairJob.status': 'ready_for_pickup',
          'repairJob.customerVerification': { $exists: false },
        },
        {
          $set: {
            'repairJob.status': 'picked_up',
            'repairJob.pickedUpAt': now,
            'repairJob.customerVerification': {
              customerId: customer._id,
              received: true,
              inspected: true,
              satisfaction: input.satisfaction,
              comments: input.comments?.trim(),
              confirmedAt: now,
            },
          },
          $push: {
            'repairJob.history': {
              actorId: customer._id,
              action: 'picked_up',
              notes: input.comments?.trim(),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!request) {
      throw new ConflictException(
        'This item is not awaiting pickup or has already been confirmed.',
      );
    }
    const quotation = request.acceptedQuotationId
      ? await this.quotations
          .findById(request.acceptedQuotationId)
          .lean()
          .exec()
      : null;
    if (quotation) {
      await this.notifications.notifyUsers([quotation.shopId], {
        title: 'Customer Confirmed Pickup',
        message: `The customer confirmed receiving their repaired ${request.appliance}.`,
        type: 'repair_picked_up',
        relatedEntityId: request._id,
        relatedEntityType: 'repair_request',
        link: `/shop/repair-requests/${request._id.toString()}`,
      });
    }
    return request.repairJob;
  }

  async reportRepairIssue(
    customerId: string,
    requestId: string,
    description: string,
  ): Promise<unknown> {
    await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    if (!description.trim()) {
      throw new BadRequestException('Describe the repair or collection issue.');
    }
    throw new BadRequestException(
      'Issue reports now use the dispute center. Open a dispute from the repair details page.',
    );
  }

  async createRepairReview(
    customerId: string,
    requestId: string,
    input: CreateRepairReviewDto,
  ): Promise<unknown> {
    const customer = await this.requireActiveCustomer(customerId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair job was not found');
    }
    const request = await this.repairRequests
      .findOne({
        _id: requestId,
        customerId: customer._id,
        'repairJob.status': 'picked_up',
        'repairJob.customerVerification.received': true,
        'repairJob.customerVerification.inspected': true,
      })
      .lean()
      .exec();
    if (!request?.acceptedQuotationId) {
      throw new ConflictException(
        'Confirm pickup and inspect the item before submitting a review.',
      );
    }
    const quotation = await this.quotations
      .findById(request.acceptedQuotationId)
      .lean()
      .exec();
    if (!quotation || quotation.shopId.equals(customer._id)) {
      throw new ConflictException('This repair is not eligible for a review.');
    }
    const now = new Date();
    let review: RepairReviewDocument | undefined;
    try {
      const createdReviews = await this.reviews.create([
        {
          repairRequestId: request._id,
          customerId: customer._id,
          shopId: quotation.shopId,
          overallRating: input.overallRating,
          repairQuality: input.repairQuality,
          communication: input.communication,
          professionalism: input.professionalism,
          timeliness: input.timeliness,
          valueForMoney: input.valueForMoney,
          title: input.title?.trim(),
          reviewText: input.reviewText.trim(),
          liked: input.liked?.trim(),
          improvement: input.improvement?.trim(),
          wouldRecommend: input.wouldRecommend,
          verifiedAt: request.repairJob?.pickedUpAt ?? now,
        },
      ]);
      review = createdReviews[0];
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A review has already been submitted for this repair.',
        );
      }
      throw error;
    }
    if (!review) {
      throw new ConflictException('The review could not be saved.');
    }
    const updated = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: request._id,
          customerId: customer._id,
          'repairJob.status': 'picked_up',
        },
        {
          $set: {
            'repairJob.status': 'completed',
            'repairJob.completedAt': now,
            'repairJob.reviewId': review._id,
          },
          $push: {
            'repairJob.history': {
              actorId: customer._id,
              action: 'completed',
              notes: 'Customer submitted a verified repair review.',
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      await this.reviews.deleteOne({ _id: review._id }).exec();
      throw new ConflictException(
        'This repair job has already been completed.',
      );
    }
    await this.notifications.notifyUsers([quotation.shopId], {
      title: 'New Customer Review',
      message: `A customer rated their ${request.appliance} repair ${input.overallRating} out of 5 stars.`,
      type: 'repair_review_received',
      relatedEntityId: review._id,
      relatedEntityType: 'repair_review',
      link: '/shop/reviews',
    });
    await this.notifications.notifyUsers([customer._id, quotation.shopId], {
      title: 'Repair Job Completed',
      message: `The ${request.appliance} repair has been completed and reviewed.`,
      type: 'repair_job_completed',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${request._id.toString()}`,
    });
    return review;
  }

  async getShopReviews(shopId: string): Promise<unknown> {
    const shop = await this.requireApprovedShop(shopId);
    const [reviews, distribution] = await Promise.all([
      this.reviews
        .aggregate<Record<string, unknown>>([
          { $match: { shopId: shop._id } },
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
          {
            $lookup: {
              from: 'users',
              localField: 'customerId',
              foreignField: '_id',
              as: 'customer',
            },
          },
          {
            $project: {
              customerName: mongoCustomerDisplayName(
                { $arrayElemAt: ['$customer.firstName', 0] },
                { $arrayElemAt: ['$customer.lastName', 0] },
                { $arrayElemAt: ['$customer.fullName', 0] },
                'Customer',
              ),
              repairRequestId: 1,
              overallRating: 1,
              repairQuality: 1,
              communication: 1,
              professionalism: 1,
              timeliness: 1,
              valueForMoney: 1,
              title: 1,
              reviewText: 1,
              liked: 1,
              improvement: 1,
              wouldRecommend: 1,
              verifiedAt: 1,
              createdAt: 1,
            },
          },
        ])
        .exec(),
      this.reviews
        .aggregate<{ _id: number; count: number }>([
          { $match: { shopId: shop._id } },
          { $group: { _id: '$overallRating', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);
    const count = distribution.reduce((sum, item) => sum + item.count, 0);
    const ratingTotal = distribution.reduce(
      (sum, item) => sum + item._id * item.count,
      0,
    );
    return {
      averageRating: count
        ? Math.round((ratingTotal / count) * 100) / 100
        : null,
      reviewCount: count,
      distribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: distribution.find((item) => item._id === rating)?.count ?? 0,
      })),
      reviews,
    };
  }

  async requireActiveCustomer(id: string) {
    if (!isObjectIdOrHexString(id)) {
      throw new ForbiddenException('An active customer account is required.');
    }
    const user = await this.users.findById(id).exec();
    if (
      !user ||
      user.accountType !== 'customer' ||
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException('An active customer account is required.');
    }
    return user;
  }

  async getShopRepairRoute(
    shopId: string,
    requestId: string,
  ): Promise<{
    distanceMeters: number;
    durationSeconds: number;
    description: string;
    path: RouteCoordinate[];
  }> {
    const shop = await this.requireApprovedShop(shopId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shop._id })
      .lean()
      .exec();
    if (!request) {
      throw new NotFoundException('Repair request was not found');
    }

    const customer = await this.users
      .findById(request.customerId)
      .select('location')
      .lean()
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer account was not found');
    }
    const origin = shop.shopDetails?.location;
    const destination =
      typeof request.customerLatitude === 'number' &&
      typeof request.customerLongitude === 'number'
        ? {
            latitude: request.customerLatitude,
            longitude: request.customerLongitude,
          }
        : customer.location;
    if (!this.isValidRouteCoordinate(origin)) {
      throw new BadRequestException(
        'Add a valid shop location before requesting directions.',
      );
    }
    if (!this.isValidRouteCoordinate(destination)) {
      throw new BadRequestException(
        'The customer has not provided a valid location for this request.',
      );
    }

    const apiKey = this.config.get<string>('GOOGLE_APIKEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Google Maps routing is not configured on the server.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.description,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: origin.latitude,
                  longitude: origin.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                },
              },
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
            languageCode: 'en',
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Google Routes API request could not be completed (${errorName}).`,
      );
      throw new BadGatewayException(
        'Google Maps directions are temporarily unavailable.',
      );
    }
    if (!response.ok) {
      let providerStatus = 'unknown';
      let providerMessage = 'No provider error details were returned.';
      try {
        const errorPayload: unknown = await response.json();
        if (
          errorPayload &&
          typeof errorPayload === 'object' &&
          'error' in errorPayload &&
          errorPayload.error &&
          typeof errorPayload.error === 'object'
        ) {
          const providerError = errorPayload.error as {
            status?: unknown;
            message?: unknown;
          };
          if (typeof providerError.status === 'string') {
            providerStatus = providerError.status;
          }
          if (typeof providerError.message === 'string') {
            providerMessage = providerError.message.slice(0, 500);
          }
        }
      } catch {
        providerMessage = 'The provider error response was not valid JSON.';
      }
      if (
        response.status === 403 &&
        providerStatus === 'PERMISSION_DENIED' &&
        /Routes API.*(?:not been used|not enabled|disabled)/i.test(
          providerMessage,
        )
      ) {
        this.logger.warn(
          'Google Routes API is not enabled for this project; trying the Directions API instead.',
        );
        return this.getGoogleDirectionsRoute(apiKey, origin, destination);
      }
      this.logger.error(
        `Google Routes API request failed (HTTP ${response.status}, ${providerStatus}): ${providerMessage}`,
      );
      throw new BadGatewayException(
        'Google Maps directions could not be calculated. Check the Routes API configuration.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Google Maps returned an invalid directions response.',
      );
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('routes' in payload) ||
      !Array.isArray(payload.routes)
    ) {
      throw new BadGatewayException(
        'Google Maps returned an invalid directions response.',
      );
    }

    const routes = payload.routes as GoogleRoute[];
    const fastest = routes
      .map((route) => ({
        route,
        durationSeconds:
          typeof route.duration === 'string'
            ? Number.parseFloat(route.duration.replace(/s$/, ''))
            : Number.NaN,
      }))
      .filter(
        ({ route, durationSeconds }) =>
          typeof route.distanceMeters === 'number' &&
          Number.isFinite(route.distanceMeters) &&
          durationSeconds >= 0 &&
          typeof route.polyline?.encodedPolyline === 'string',
      )
      .sort((left, right) => left.durationSeconds - right.durationSeconds)[0];
    if (!fastest || typeof fastest.route.distanceMeters !== 'number') {
      throw new BadGatewayException(
        'Google Maps did not find a driving route for these locations.',
      );
    }

    return {
      distanceMeters: fastest.route.distanceMeters,
      durationSeconds: fastest.durationSeconds,
      description: fastest.route.description?.trim() || 'Fastest driving route',
      path: decodeGooglePolyline(fastest.route.polyline!.encodedPolyline!),
    };
  }

  private async getGoogleDirectionsRoute(
    apiKey: string,
    origin: RouteCoordinate,
    destination: RouteCoordinate,
  ): Promise<ShopRepairRouteResult> {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
    url.searchParams.set(
      'destination',
      `${destination.latitude},${destination.longitude}`,
    );
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Google Directions API request could not be completed (${errorName}).`,
      );
      throw new BadGatewayException(
        'Google Maps directions are temporarily unavailable.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Google Maps returned an invalid directions response.',
      );
    }
    if (!response.ok || !payload || typeof payload !== 'object') {
      this.logger.error(
        `Google Directions API request failed (HTTP ${response.status}).`,
      );
      throw new BadGatewayException(
        'Google Maps directions could not be calculated. Check the Directions API configuration.',
      );
    }

    const directionsResponse = payload as {
      status?: unknown;
      error_message?: unknown;
      routes?: unknown;
    };
    const providerStatus =
      typeof directionsResponse.status === 'string'
        ? directionsResponse.status
        : 'unknown';
    const providerMessage =
      typeof directionsResponse.error_message === 'string'
        ? directionsResponse.error_message.slice(0, 500)
        : 'No provider error details were returned.';
    if (providerStatus !== 'OK' || !Array.isArray(directionsResponse.routes)) {
      this.logger.error(
        `Google Directions API request failed (${providerStatus}): ${providerMessage}`,
      );
      throw new BadGatewayException(
        'Google Maps directions could not be calculated. Check the Directions API configuration.',
      );
    }

    const fastest = (directionsResponse.routes as GoogleDirectionsRoute[])
      .map((route) => {
        const legs = Array.isArray(route.legs) ? route.legs : [];
        return {
          route,
          distanceMeters: legs.reduce(
            (total, leg) => total + (leg.distance?.value ?? Number.NaN),
            0,
          ),
          durationSeconds: legs.reduce(
            (total, leg) => total + (leg.duration?.value ?? Number.NaN),
            0,
          ),
        };
      })
      .filter(
        ({ distanceMeters, durationSeconds, route }) =>
          Number.isFinite(distanceMeters) &&
          distanceMeters >= 0 &&
          Number.isFinite(durationSeconds) &&
          durationSeconds >= 0 &&
          typeof route.overview_polyline?.points === 'string',
      )
      .sort((left, right) => left.durationSeconds - right.durationSeconds)[0];
    if (!fastest || !fastest.route.overview_polyline?.points) {
      throw new BadGatewayException(
        'Google Maps did not find a driving route for these locations.',
      );
    }

    return {
      distanceMeters: fastest.distanceMeters,
      durationSeconds: fastest.durationSeconds,
      description: fastest.route.summary?.trim() || 'Fastest driving route',
      path: decodeGooglePolyline(fastest.route.overview_polyline.points),
    };
  }

  private isValidRouteCoordinate(
    location: RouteCoordinate | null | undefined,
  ): location is RouteCoordinate {
    return (
      !!location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private async requireApprovedShop(id: string) {
    if (!isObjectIdOrHexString(id)) {
      throw new ForbiddenException('An approved shop account is required.');
    }
    const user = await this.users.findById(id).exec();
    if (
      !user ||
      user.accountType !== 'shop' ||
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException('An approved shop account is required.');
    }
    const registration = await this.registrations
      .findOne({
        userId: user._id,
        accountType: 'shop',
        registrationStatus: 'approved',
        paymentStatus: 'paid',
      })
      .exec();
    if (!registration) {
      throw new ForbiddenException('An approved shop account is required.');
    }
    return user;
  }

  private async initializeShopResponse(
    requestId: Types.ObjectId,
    shopId: Types.ObjectId,
  ): Promise<void> {
    const quotation = await this.quotations
      .findOne({ repairRequestId: requestId, shopId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const status =
      quotation?.status === 'accepted'
        ? 'customer_accepted'
        : ['declined', 'rejected'].includes(quotation?.status ?? '')
          ? 'customer_rejected'
          : quotation?.status === 'expired'
            ? 'expired'
            : quotation
              ? 'quotation_submitted'
              : 'new';
    await this.repairRequests
      .updateOne(
        {
          _id: requestId,
          shopIds: shopId,
          'shopResponses.shopId': { $ne: shopId },
        },
        {
          $push: {
            shopResponses: {
              shopId,
              status,
              respondedAt: quotation?.updatedAt ?? quotation?.createdAt,
            },
          },
        },
      )
      .exec();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private async synchronizeShopResponseFromQuotation(
    requestId: Types.ObjectId,
    shopId: Types.ObjectId,
    quotation: RepairQuotationDocument,
  ): Promise<void> {
    const status =
      quotation.status === 'accepted'
        ? 'customer_accepted'
        : ['declined', 'rejected'].includes(quotation.status)
          ? 'customer_rejected'
          : quotation.status === 'expired'
            ? 'expired'
            : 'quotation_submitted';
    await this.repairRequests
      .updateOne(
        {
          _id: requestId,
          shopIds: shopId,
          shopResponses: {
            $elemMatch: {
              shopId,
              status: { $in: ['new', 'pending'] },
            },
          },
        },
        {
          $set: {
            'shopResponses.$.status': status,
            'shopResponses.$.respondedAt':
              quotation.updatedAt ?? quotation.createdAt,
          },
        },
      )
      .exec();
  }

  private normalizeQuotationStatus(
    status: RepairQuotation['status'],
  ): 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' {
    if (status === 'sent') {
      return 'pending';
    }
    if (status === 'declined') {
      return 'rejected';
    }
    return status;
  }

  private matchesQuotationFilters(
    quote: {
      _id?: Types.ObjectId | string;
      status: string;
      createdAt: Date;
      amount: number;
      validUntil?: Date | string;
      repairRequest?: {
        _id?: Types.ObjectId | string;
        appliance?: string;
        description?: string;
        brand?: string;
        model?: string;
      };
      customer?: { firstName?: string; lastName?: string };
      shop?: { shopName?: string };
    },
    filters: QuotationListQueryDto,
  ): boolean {
    if (
      filters.status &&
      filters.status !== 'all' &&
      quote.status !== filters.status
    ) {
      return false;
    }
    if (filters.minAmount !== undefined && quote.amount < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount !== undefined && quote.amount > filters.maxAmount) {
      return false;
    }
    if (
      filters.validity &&
      (quote.validUntil && new Date(quote.validUntil).getTime() <= Date.now()
        ? 'expired'
        : 'valid') !== filters.validity
    ) {
      return false;
    }
    const createdAt = new Date(quote.createdAt);
    if (filters.from && createdAt < new Date(filters.from)) {
      return false;
    }
    if (filters.to) {
      const endDate = new Date(filters.to);
      endDate.setHours(23, 59, 59, 999);
      if (createdAt > endDate) {
        return false;
      }
    }
    const request = quote.repairRequest;
    const includes = (
      value: string | undefined,
      candidate: string | undefined,
    ): boolean =>
      !value ||
      (candidate ?? '')
        .toLocaleLowerCase()
        .includes(value.trim().toLocaleLowerCase());
    if (
      !includes(filters.appliance, request?.appliance) ||
      !includes(filters.shop, quote.shop?.shopName) ||
      !includes(
        filters.customer,
        formatUserName(quote.customer ?? {}),
      )
    ) {
      return false;
    }
    const search = filters.search?.trim().toLocaleLowerCase();
    if (!search) {
      return true;
    }
    return [
      request?._id?.toString(),
      quote._id?.toString(),
      request?.appliance,
      request?.description,
      request?.brand,
      request?.model,
      formatUserName(quote.customer ?? {}),
      quote.shop?.shopName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(search);
  }

  private validateQuotationFilters(filters: QuotationListQueryDto): void {
    this.validateDateRange(filters.from, filters.to);
    if (
      filters.minAmount !== undefined &&
      filters.maxAmount !== undefined &&
      filters.minAmount > filters.maxAmount
    ) {
      throw new BadRequestException(
        'Minimum quotation amount cannot exceed the maximum amount.',
      );
    }
  }

  private validateDateRange(from?: string, to?: string): void {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      throw new BadRequestException(
        'The start date cannot be after the end date.',
      );
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private quotationSummary(
    quotations: Array<{ status: string }>,
  ): Record<string, number> {
    return {
      total: quotations.length,
      pending: quotations.filter((quote) => quote.status === 'pending').length,
      accepted: quotations.filter((quote) => quote.status === 'accepted')
        .length,
      rejected: quotations.filter((quote) => quote.status === 'rejected')
        .length,
      expired: quotations.filter((quote) => quote.status === 'expired').length,
      withdrawn: quotations.filter((quote) => quote.status === 'withdrawn')
        .length,
    };
  }

  private sortQuotations<T extends { amount: number; createdAt: Date }>(
    quotations: T[],
    sort: QuotationListQueryDto['sort'],
  ): void {
    quotations.sort((left, right) => {
      if (sort === 'amount_low') {
        return left.amount - right.amount;
      }
      if (sort === 'amount_high') {
        return right.amount - left.amount;
      }
      const direction = sort === 'oldest' ? 1 : -1;
      return (
        (new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()) *
        direction
      );
    });
  }

  private async expireQuotations(shopId?: Types.ObjectId): Promise<void> {
    const now = new Date();
    const expired = await this.quotations
      .find({
        ...(shopId ? { shopId } : {}),
        status: { $in: ['pending', 'sent'] },
        validUntil: { $lte: now },
      })
      .exec();
    await Promise.all(
      expired.map((quotation) => this.expireQuotation(quotation)),
    );
  }

  private async expireQuotation(
    quotation: RepairQuotationDocument,
  ): Promise<void> {
    const now = new Date();
    const result = await this.quotations
      .updateOne(
        {
          _id: quotation._id,
          status: { $in: ['pending', 'sent'] },
          validUntil: { $lte: now },
        },
        { $set: { status: 'expired', respondedAt: now } },
      )
      .exec();
    if (!result.modifiedCount) {
      return;
    }
    await this.repairRequests
      .updateOne(
        {
          _id: quotation.repairRequestId,
          shopResponses: {
            $elemMatch: {
              shopId: quotation.shopId,
              status: 'quotation_submitted',
            },
          },
        },
        {
          $set: {
            'shopResponses.$.status': 'expired',
            'shopResponses.$.respondedAt': now,
          },
        },
      )
      .exec();
    await this.notifications.notifyUsers([quotation.shopId], {
      title: 'Quotation Expired',
      message:
        'A quotation you submitted has expired without a customer response.',
      type: 'quotation_expired',
      relatedEntityId: quotation._id,
      relatedEntityType: 'repair_quotation',
      link: `/shop/quotations?quotationId=${quotation._id.toString()}`,
    });
  }

  private distanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const radians = (value: number) => (value * Math.PI) / 180;
    const deltaLatitude = radians(lat2 - lat1);
    const deltaLongitude = radians(lon2 - lon1);
    const haversine =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(radians(lat1)) *
        Math.cos(radians(lat2)) *
        Math.sin(deltaLongitude / 2) ** 2;
    return (
      Math.round(
        6371 *
          2 *
          Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) *
          10,
      ) / 10
    );
  }
}
