import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Connection,
  isObjectIdOrHexString,
  Model,
  PipelineStage,
  Types,
} from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ShopDetails, User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { formatUserName, userNameParts } from '../users/user-name';
import { DeclineRegistrationDto } from './dto/decline-registration.dto';
import { AdminAuditLog } from './schemas/admin-audit-log.schema';
import {
  LEGACY_REPAIR_JOB_STATUSES,
  REPAIR_JOB_STATUSES,
  RepairQuotation,
  RepairReview,
  RepairRequest,
} from '../customer/repair-request.schema';
import { ShopSubscriptionInvoice } from '../payments/schemas/shop-subscription-invoice.schema';

const NON_ACTIVE_MAP_REPAIR_STATUSES = [
  'pending',
  'completed',
  'repair_declined',
  'disputed',
  'cancelled',
];

export interface ShopApplication {
  id: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  createdAt: Date;
  shop: ShopDetails | null;
}

export interface AdminUserRepairHistory {
  id: string;
  appliance: string;
  description: string;
  status: string;
  repairStatus: string | null;
  createdAt: Date;
  preferredServiceDate: Date | null;
}

export interface AdminUserQuotationHistory {
  id: string;
  repairRequestId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  validUntil: Date | null;
}

export interface AdminRegistrationRequest {
  id: string;
  userId: string;
  registrationRequestId: string | null;
  registrationNumber: string;
  applicantName: string;
  shopName: string | null;
  businessType: string | null;
  businessAddress: string | null;
  services: string[];
  email: string;
  countryCode: string;
  mobileNumber: string;
  accountType: 'customer' | 'shop';
  accountStatus: 'active' | 'inactive' | 'suspended' | null;
  registrationStatus: 'pending' | 'approved' | 'declined';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  subscriptionPlan: 'Fixroa Shop monthly subscription' | null;
  paymentAmountCents: number | null;
  paymentCurrency: string | null;
  paidAt: Date | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  declineReason: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  state: string;
}

export interface RegistrationRequestPage {
  requests: AdminRegistrationRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  accountType: 'customer' | 'shop';
  accountStatus: 'active' | 'inactive' | 'suspended' | null;
  approvalStatus: 'pending' | 'approved' | 'declined';
  profileImageUrl: string | null;
  createdAt: Date;
  location: { latitude: number; longitude: number } | null;
  shop: {
    shopName: string;
    businessType: string;
    description: string;
    yearsOfExperience: number;
    address: string;
    street: string;
    area: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark: string;
    services: string[];
  } | null;
  registration: {
    registrationNumber: string;
    status: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    declineReason: string | null;
    adminRemarks: string | null;
    paymentStatus: string;
    paymentAmountCents: number | null;
    paymentCurrency: string | null;
    paidAt: Date | null;
  } | null;
  repairActivity: AdminUserRepairHistory[];
  quotationActivity: AdminUserQuotationHistory[];
}

export interface AdminUserStatistics {
  totalUsers: number;
  totalCustomers: number;
  totalRepairShops: number;
  pendingApprovals: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
}

export interface AdminMapEntity {
  id: string;
  type: 'customer' | 'shop' | 'request';
  name: string;
  location: { latitude: number; longitude: number } | null;
  address: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  status: string;
  accountStatus?: string | null;
  approvalStatus?: string;
  ownerName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shopName?: string;
  shopAddress?: string;
  shopCity?: string;
  shopState?: string;
  shopEmail?: string;
  shopPhone?: string;
  shopLocation?: { latitude: number; longitude: number } | null;
  appliance?: string;
  serviceType?: string;
  description?: string;
  createdAt?: Date;
  quotationAmount?: number | null;
  quotationCurrency?: string | null;
  repairCounts?: { total: number; active: number; completed: number };
}

export interface AdminMapData {
  counts: {
    customers: number;
    shops: number;
    requests: number;
    active: number;
    completed: number;
    disputed: number;
  };
  entities: AdminMapEntity[];
  markers?: AdminMapMarker[];
  page: number;
  limit: number;
  total: number;
}

export interface AdminMapMarker {
  id: string;
  type: 'request';
  name: string;
  status: string;
  location: { latitude: number; longitude: number };
}

export interface AdminUserActivity {
  id: string;
  adminUserId: string;
  action: string;
  previousApprovalStatus: string;
  newApprovalStatus: string;
  previousAccountStatus: string;
  newAccountStatus: string;
  reason: string | null;
  createdAt: Date;
}

export interface AdminDashboardOverview {
  range: { from: string; to: string };
  users: {
    customers: {
      total: number;
      new: number;
      previous: number;
      changePercent: number | null;
      active: number;
      inactive: number;
      suspended: number;
    };
    shops: {
      total: number;
      approved: number;
      pending: number;
      declined: number;
      new: number;
      previous: number;
      active: number;
      inactive: number;
      suspended: number;
    };
  };
  repairs: {
    total: number;
    new: number;
    previous: number;
    changePercent: number | null;
    shared: number;
    pendingShopResponses: number;
    accepted: number;
    declined: number;
    expired: number;
    completed: number;
    completionRate: number;
  };
  quotations: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
    acceptanceRate: number;
  };
  subscriptionFinancials: {
    currencyTotals: Array<{
      currency: string;
      accountReceivableCents: number;
      overdueAmountCents: number;
      subscriptionRevenueCents: number;
    }>;
  };
  trends: Array<{
    period: string;
    customers: number;
    shops: number;
    repairs: number;
    quotations: number;
  }>;
  repairStatuses: Array<{ status: string; count: number }>;
  quotationStatuses: Array<{ status: string; count: number }>;
  categories: Array<{ name: string; count: number; percentage: number }>;
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    relatedName: string | null;
    createdAt: Date;
    link: string;
    amountCents?: number;
    currency?: string;
    status?: string;
  }>;
  recentRegistrations: Array<{
    id: string;
    name: string;
    accountType: 'customer' | 'shop';
    createdAt: Date;
  }>;
  recentRepairs: Array<{
    id: string;
    customerId: string;
    customerName: string;
    appliance: string;
    description: string;
    createdAt: Date;
    shopsNotified: number;
    status: string;
  }>;
  topShops: Array<{
    id: string;
    name: string;
    location: string;
    accountStatus: string;
    completedRepairs: number;
  }>;
}

interface AggregatedRegistrationRequest extends Record<string, unknown> {
  requests?: Array<Record<string, unknown>>;
  metadata?: Array<{ total: number }>;
}

interface AdminSubscriptionActivity {
  id: string;
  type: string;
  description: string;
  relatedName: string | null;
  createdAt: Date;
  link: string;
  amountCents?: number;
  currency?: string;
  status?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectModel(RegistrationRequest.name)
    private readonly registrationRequests: Model<RegistrationRequest>,
    @InjectModel(ShopSubscriptionInvoice.name)
    private readonly subscriptionInvoices: Model<ShopSubscriptionInvoice>,
    @InjectModel(AdminAuditLog.name)
    private readonly auditLogs: Model<AdminAuditLog>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(RepairQuotation.name)
    private readonly repairQuotations: Model<RepairQuotation>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
    @InjectModel(RepairReview.name)
    private readonly repairReviews: Model<RepairReview>,
  ) {}

  async getRepairJobMonitor(query: {
    status?: string;
    requestId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    jobs: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }> {
    const statuses = [
      'all',
      ...REPAIR_JOB_STATUSES,
      ...LEGACY_REPAIR_JOB_STATUSES,
    ];
    const status = query.status || 'all';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (!statuses.includes(status) || !Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invalid repair job filters');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Page size must be between 1 and 100');
    }
    const match: Record<string, unknown> =
      status === 'all'
        ? {
            $or: [
              {
                $and: [
                  { 'repairJob.status': { $exists: true } },
                  { acceptedQuotationId: { $exists: true } },
                ],
              },
              {
                $and: [
                  { 'repairJob.status': { $exists: false } },
                  { status: 'completed' },
                ],
              },
            ],
          }
        : status === 'completed'
          ? {
              $or: [
                {
                  $and: [
                    { 'repairJob.status': 'completed' },
                    { acceptedQuotationId: { $exists: true } },
                  ],
                },
                {
                  $and: [
                    { 'repairJob.status': { $exists: false } },
                    { status: 'completed' },
                  ],
                },
              ],
            }
          : {
              'repairJob.status': { $exists: true },
              acceptedQuotationId: { $exists: true },
            };
    if (query.from || query.to) {
      const start = query.from
        ? this.parseDashboardDate(query.from, 'start')
        : undefined;
      const end = query.to
        ? this.parseDashboardDate(query.to, 'end')
        : undefined;
      if (start && end && start.getTime() > end.getTime()) {
        throw new BadRequestException('Start date must be before end date');
      }
      match.createdAt = {
        ...(start ? { $gte: start } : {}),
        ...(end ? { $lte: end } : {}),
      };
    }
    if (query.requestId) {
      if (!isObjectIdOrHexString(query.requestId)) {
        throw new BadRequestException('Invalid repair request ID');
      }
      match._id = new Types.ObjectId(query.requestId);
    }
    if (status !== 'all' && status !== 'completed') {
      match['repairJob.status'] = status;
    }
    const search = query.search?.trim();
    const searchPattern = search
      ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;
    const [result] = await this.repairRequests
      .aggregate<{
        jobs: Record<string, unknown>[];
        metadata: Array<{ total: number }>;
      }>([
        { $match: match },
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
                  email: 1,
                  countryCode: 1,
                  mobileNumber: 1,
                },
              },
            ],
            as: 'customer',
          },
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'repair_quotations',
            localField: 'acceptedQuotationId',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  shopId: 1,
                  amount: 1,
                  currency: 1,
                  status: 1,
                  message: 1,
                  inspectionCharge: 1,
                  partsCost: 1,
                  labourCharge: 1,
                  additionalCharges: 1,
                  proposedSolution: 1,
                  warrantyInformation: 1,
                  additionalNotes: 1,
                  estimatedDays: 1,
                  validUntil: 1,
                  createdAt: 1,
                },
              },
            ],
            as: 'quotation',
          },
        },
        { $unwind: { path: '$quotation', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'quotation.shopId',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  fullName: 1,
                  email: 1,
                  countryCode: 1,
                  mobileNumber: 1,
                  shopDetails: 1,
                },
              },
            ],
            as: 'shop',
          },
        },
        { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
        ...(searchPattern
          ? [
              {
                $addFields: {
                  repairRequestIdText: { $toString: '$_id' },
                },
              },
              {
                $match: {
                  $or: [
                    { repairRequestIdText: searchPattern },
                    { appliance: searchPattern },
                    { description: searchPattern },
                    { 'customer.fullName': searchPattern },
                    { 'customer.firstName': searchPattern },
                    { 'customer.lastName': searchPattern },
                    { 'customer.email': searchPattern },
                    { 'shop.shopDetails.shopName': searchPattern },
                  ],
                },
              },
            ]
          : []),
        {
          $addFields: {
            repairJob: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'completed'] },
                    {
                      $eq: [{ $ifNull: ['$repairJob.status', null] }, null],
                    },
                  ],
                },
                {
                  $mergeObjects: [
                    { $ifNull: ['$repairJob', {}] },
                    { status: 'completed' },
                  ],
                },
                '$repairJob',
              ],
            },
          },
        },
        {
          $facet: {
            jobs: [
              { $sort: { updatedAt: -1 } },
              { $skip: (page - 1) * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  appliance: 1,
                  serviceType: 1,
                  description: 1,
                  brand: 1,
                  model: 1,
                  preferredServiceDate: 1,
                  photos: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  repairJob: {
                    status: 1,
                    confirmedAt: 1,
                    inspection: {
                      status: 1,
                      identifiedProblem: 1,
                      findings: 1,
                      requiredRepairWork: 1,
                      parts: 1,
                      images: 1,
                      partsTotal: 1,
                      labourCharge: 1,
                      inspectionCharges: 1,
                      otherCharges: 1,
                      estimatedTotal: 1,
                      estimatedTimeValue: 1,
                      estimatedTimeUnit: 1,
                      warranty: 1,
                      message: 1,
                      decisionReason: 1,
                      submittedAt: 1,
                      decidedAt: 1,
                    },
                    approvedRepairAmount: 1,
                    startedAt: 1,
                    repairCompletedAt: 1,
                    completionDescription: 1,
                    workPerformed: 1,
                    partsReplaced: 1,
                    finalNotes: 1,
                    pickupInstructions: 1,
                    pickupMessage: 1,
                    readyForPickupAt: 1,
                    pickedUpAt: 1,
                    disputeDescription: 1,
                    disputeResolution: 1,
                    completedAt: 1,
                    history: 1,
                  },
                  customer: {
                    firstName: '$customer.firstName',
                    lastName: '$customer.lastName',
                    displayName: mongoUserDisplayName(
                      '$customer.firstName',
                      '$customer.lastName',
                      '$customer.fullName',
                      'Customer',
                    ),
                    email: '$customer.email',
                    countryCode: '$customer.countryCode',
                    mobileNumber: '$customer.mobileNumber',
                  },
                  shopName: '$shop.shopDetails.shopName',
                  shop: {
                    firstName: '$shop.firstName',
                    lastName: '$shop.lastName',
                    displayName: mongoUserDisplayName(
                      '$shop.firstName',
                      '$shop.lastName',
                      '$shop.fullName',
                    ),
                    email: '$shop.email',
                    countryCode: '$shop.countryCode',
                    mobileNumber: '$shop.mobileNumber',
                    address: '$shop.shopDetails.address',
                    city: '$shop.shopDetails.city',
                    state: '$shop.shopDetails.state',
                    postalCode: '$shop.shopDetails.postalCode',
                  },
                  quotation: {
                    $cond: [
                      { $ifNull: ['$quotation._id', false] },
                      {
                        id: { $toString: '$quotation._id' },
                        amount: '$quotation.amount',
                        currency: '$quotation.currency',
                        status: '$quotation.status',
                        message: '$quotation.message',
                        inspectionCharge: '$quotation.inspectionCharge',
                        partsCost: '$quotation.partsCost',
                        labourCharge: '$quotation.labourCharge',
                        additionalCharges: '$quotation.additionalCharges',
                        proposedSolution: '$quotation.proposedSolution',
                        warrantyInformation: '$quotation.warrantyInformation',
                        additionalNotes: '$quotation.additionalNotes',
                        estimatedDays: '$quotation.estimatedDays',
                        validUntil: '$quotation.validUntil',
                        createdAt: '$quotation.createdAt',
                      },
                      null,
                    ],
                  },
                },
              },
            ],
            metadata: [{ $count: 'total' }],
          },
        },
      ])
      .exec();
    return {
      jobs: result?.jobs ?? [],
      page,
      limit,
      total: result?.metadata[0]?.total ?? 0,
    };
  }

  async getRepairReviewMonitor(query: {
    page?: number;
    limit?: number;
  }): Promise<{
    reviews: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException('Invalid review pagination');
    }
    const [total, reviews] = await Promise.all([
      this.repairReviews.countDocuments().exec(),
      this.repairReviews
        .aggregate<Record<string, unknown>>([
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
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
          { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'users',
              localField: 'shopId',
              foreignField: '_id',
              pipeline: [{ $project: { shopDetails: 1 } }],
              as: 'shop',
            },
          },
          { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'repair_requests',
              localField: 'repairRequestId',
              foreignField: '_id',
              pipeline: [{ $project: { appliance: 1 } }],
              as: 'repair',
            },
          },
          { $unwind: { path: '$repair', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
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
              customerName: mongoUserDisplayName(
                '$customer.firstName',
                '$customer.lastName',
                '$customer.fullName',
              ),
              shopName: '$shop.shopDetails.shopName',
              appliance: '$repair.appliance',
            },
          },
        ])
        .exec(),
    ]);
    return { reviews, page, limit, total };
  }

  async getDashboardOverview(
    fromInput?: string,
    toInput?: string,
  ): Promise<AdminDashboardOverview> {
    const now = new Date();
    const to = toInput ? this.parseDashboardDate(toInput, 'end') : now;
    const from = fromInput
      ? this.parseDashboardDate(fromInput, 'start')
      : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Start date must be before end date');
    }
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Dashboard date range cannot exceed 366 days',
      );
    }
    const endExclusive = new Date(to.getTime() + 1);
    const duration = endExclusive.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - duration);
    const previousTo = from;
    const currentPeriod = { $gte: from, $lt: endExclusive };
    const previousPeriod = { $gte: previousFrom, $lt: previousTo };
    const bucketFormat =
      duration > 90 * 24 * 60 * 60 * 1000 ? '%Y-%m' : '%Y-%m-%d';
    const bucketId = {
      $dateToString: {
        format: bucketFormat,
        date: '$createdAt',
        timezone: 'UTC',
      },
    };
    const countedStatus = async (
      model: Model<RepairRequest> | Model<RepairQuotation>,
      match: Record<string, unknown>,
      statusExpression?: Record<string, unknown>,
    ): Promise<Array<{ _id: string; count: number }>> => {
      const pipeline: PipelineStage[] = [{ $match: match }];
      if (statusExpression) {
        pipeline.push({ $addFields: { dashboardStatus: statusExpression } });
      }
      pipeline.push({
        $group: {
          _id: statusExpression ? '$dashboardStatus' : '$status',
          count: { $sum: 1 },
        },
      });
      return model.aggregate<{ _id: string; count: number }>(pipeline).exec();
    };

    const [
      customerTotal,
      shopTotal,
      customerNew,
      customerPrevious,
      shopNew,
      shopPrevious,
      shopApprovalGroups,
      lifecycleGroups,
      repairTotal,
      repairNew,
      repairPrevious,
      repairShared,
      repairAccepted,
      repairDeclined,
      repairExpired,
      repairStatusGroups,
      shopResponseGroups,
      quotationTotal,
      quotationStatusGroups,
      trendUsers,
      trendRepairs,
      trendQuotations,
      categoriesRaw,
      recentRepairRecords,
      recentQuotationRecords,
      recentRegistrationRecords,
      recentAuditRecords,
      topShopsRaw,
    ] = await Promise.all([
      this.users.countDocuments({ accountType: 'customer' }).exec(),
      this.users.countDocuments({ accountType: 'shop' }).exec(),
      this.users
        .countDocuments({ accountType: 'customer', createdAt: currentPeriod })
        .exec(),
      this.users
        .countDocuments({ accountType: 'customer', createdAt: previousPeriod })
        .exec(),
      this.users
        .countDocuments({ accountType: 'shop', createdAt: currentPeriod })
        .exec(),
      this.users
        .countDocuments({ accountType: 'shop', createdAt: previousPeriod })
        .exec(),
      this.users
        .aggregate<{ _id: string; count: number }>([
          { $match: { accountType: 'shop' } },
          {
            $lookup: {
              from: 'registration_requests',
              localField: '_id',
              foreignField: 'userId',
              as: 'registrations',
            },
          },
          {
            $addFields: {
              approvalStatus: {
                $ifNull: [
                  { $arrayElemAt: ['$registrations.registrationStatus', 0] },
                  {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ['$accountStatus', 'pending_approval'] },
                          then: 'pending',
                        },
                        {
                          case: { $eq: ['$accountStatus', 'rejected'] },
                          then: 'declined',
                        },
                      ],
                      default: 'approved',
                    },
                  },
                ],
              },
            },
          },
          { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
        ])
        .exec(),
      this.users
        .aggregate<{
          _id: { accountType: string; accountStatus: string };
          count: number;
        }>([
          { $match: { accountType: { $in: ['customer', 'shop'] } } },
          {
            $addFields: {
              lifecycleStatus: {
                $ifNull: [
                  '$accountLifecycleStatus',
                  {
                    $cond: [
                      { $eq: ['$accountStatus', 'active'] },
                      'active',
                      'inactive',
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                accountType: '$accountType',
                accountStatus: '$lifecycleStatus',
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.repairRequests.countDocuments().exec(),
      this.repairRequests.countDocuments({ createdAt: currentPeriod }).exec(),
      this.repairRequests.countDocuments({ createdAt: previousPeriod }).exec(),
      this.repairRequests
        .countDocuments({
          $expr: { $gt: [{ $size: { $ifNull: ['$shopIds', []] } }, 0] },
        })
        .exec(),
      this.repairRequests
        .countDocuments({ acceptedQuotationId: { $exists: true } })
        .exec(),
      this.repairRequests
        .countDocuments({
          shopResponses: {
            $elemMatch: { status: { $in: ['declined', 'customer_rejected'] } },
          },
        })
        .exec(),
      this.repairRequests
        .countDocuments({
          shopResponses: { $elemMatch: { status: 'expired' } },
        })
        .exec(),
      countedStatus(
        this.repairRequests,
        {},
        {
          $ifNull: ['$repairJob.status', '$status'],
        },
      ),
      this.repairRequests
        .aggregate<{ _id: string; count: number }>([
          { $unwind: '$shopResponses' },
          { $group: { _id: '$shopResponses.status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.repairQuotations.countDocuments().exec(),
      countedStatus(
        this.repairQuotations,
        {},
        {
          $cond: [
            {
              $and: [
                { $in: ['$status', ['pending', 'sent']] },
                { $lt: ['$validUntil', now] },
                { $ne: [{ $ifNull: ['$validUntil', null] }, null] },
              ],
            },
            'expired',
            { $cond: [{ $eq: ['$status', 'sent'] }, 'pending', '$status'] },
          ],
        },
      ),
      this.users
        .aggregate<{
          _id: { period: string; accountType: string };
          count: number;
        }>([
          {
            $match: {
              accountType: { $in: ['customer', 'shop'] },
              createdAt: currentPeriod,
            },
          },
          {
            $group: {
              _id: {
                period: {
                  $dateToString: {
                    format: bucketFormat,
                    date: '$createdAt',
                    timezone: 'UTC',
                  },
                },
                accountType: '$accountType',
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.repairRequests
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: currentPeriod } },
          { $group: { _id: bucketId, count: { $sum: 1 } } },
        ])
        .exec(),
      this.repairQuotations
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: currentPeriod } },
          { $group: { _id: bucketId, count: { $sum: 1 } } },
        ])
        .exec(),
      this.repairRequests
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: currentPeriod } },
          { $group: { _id: '$appliance', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .exec(),
      this.repairRequests
        .aggregate<Record<string, unknown>>([
          { $sort: { createdAt: -1 } },
          { $limit: 8 },
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
              appliance: 1,
              description: 1,
              status: { $ifNull: ['$repairJob.status', '$status'] },
              createdAt: 1,
              shopIds: 1,
              customerId: 1,
              customerName: mongoUserDisplayName(
                { $arrayElemAt: ['$customer.firstName', 0] },
                { $arrayElemAt: ['$customer.lastName', 0] },
                { $arrayElemAt: ['$customer.fullName', 0] },
                'Customer',
              ),
            },
          },
        ])
        .exec(),
      this.repairQuotations
        .aggregate<Record<string, unknown>>([
          { $sort: { createdAt: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: 'users',
              localField: 'shopId',
              foreignField: '_id',
              as: 'shop',
            },
          },
          {
            $project: {
              createdAt: 1,
              respondedAt: 1,
              status: 1,
              shopId: 1,
              shopName: {
                $ifNull: [
                  { $arrayElemAt: ['$shop.shopDetails.shopName', 0] },
                  'Repair shop',
                ],
              },
            },
          },
        ])
        .exec(),
      this.users
        .aggregate<Record<string, unknown>>([
          { $match: { accountType: { $in: ['customer', 'shop'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 8 },
          {
            $project: {
              accountType: 1,
              firstName: 1,
              lastName: 1,
              fullName: 1,
              shopDetails: 1,
              createdAt: 1,
            },
          },
        ])
        .exec(),
      this.auditLogs
        .aggregate<Record<string, unknown>>([
          { $sort: { createdAt: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: 'users',
              localField: 'targetUserId',
              foreignField: '_id',
              as: 'target',
            },
          },
          {
            $project: {
              action: 1,
              createdAt: 1,
              targetUserId: 1,
              targetName: {
                $ifNull: [
                  { $arrayElemAt: ['$target.shopDetails.shopName', 0] },
                  mongoUserDisplayName(
                    { $arrayElemAt: ['$target.firstName', 0] },
                    { $arrayElemAt: ['$target.lastName', 0] },
                    { $arrayElemAt: ['$target.fullName', 0] },
                    'User',
                  ),
                ],
              },
            },
          },
        ])
        .exec(),
      this.repairQuotations
        .aggregate<{
          _id: Types.ObjectId;
          count: number;
          name: string;
          city: string;
          state: string;
          accountStatus: string;
        }>([
          { $match: { status: 'accepted' } },
          {
            $lookup: {
              from: 'repair_requests',
              localField: 'repairRequestId',
              foreignField: '_id',
              as: 'repair',
            },
          },
          { $unwind: '$repair' },
          {
            $match: {
              $expr: {
                $eq: [
                  {
                    $ifNull: ['$repair.repairJob.status', '$repair.status'],
                  },
                  'completed',
                ],
              },
            },
          },
          { $group: { _id: '$shopId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'shop',
            },
          },
          {
            $project: {
              count: 1,
              name: {
                $ifNull: [
                  { $arrayElemAt: ['$shop.shopDetails.shopName', 0] },
                  'Repair shop',
                ],
              },
              city: {
                $ifNull: [{ $arrayElemAt: ['$shop.shopDetails.city', 0] }, ''],
              },
              state: {
                $ifNull: [{ $arrayElemAt: ['$shop.shopDetails.state', 0] }, ''],
              },
              accountStatus: {
                $ifNull: [
                  { $arrayElemAt: ['$shop.accountLifecycleStatus', 0] },
                  {
                    $ifNull: [
                      { $arrayElemAt: ['$shop.accountStatus', 0] },
                      'unavailable',
                    ],
                  },
                ],
              },
            },
          },
        ])
        .exec(),
    ]);

    const getCount = (
      groups: Array<{ status: string; count: number }>,
      key: string,
    ): number => groups.find((group) => group.status === key)?.count ?? 0;
    const getGroupedCount = (
      groups: Array<{ _id: string; count: number }>,
      key: string,
    ): number => groups.find((group) => group._id === key)?.count ?? 0;
    const lifecycleCount = (
      accountType: string,
      accountStatus: string,
    ): number =>
      lifecycleGroups.find(
        (group) =>
          group._id.accountType === accountType &&
          group._id.accountStatus === accountStatus,
      )?.count ?? 0;
    const repairStatuses = repairStatusGroups.map((group) => ({
      status: group._id,
      count: group.count,
    }));
    const quotationStatuses = quotationStatusGroups.map((group) => ({
      status: group._id,
      count: group.count,
    }));
    const completed = getCount(repairStatuses, 'completed');
    const acceptedQuotations = getCount(quotationStatuses, 'accepted');
    const rejectedQuotations =
      getCount(quotationStatuses, 'rejected') +
      getCount(quotationStatuses, 'declined');
    const expiredQuotations = getCount(quotationStatuses, 'expired');
    const pendingQuotations = getCount(quotationStatuses, 'pending');
    const customerTrend = new Map<string, number>();
    const shopTrend = new Map<string, number>();
    for (const point of trendUsers) {
      (point._id.accountType === 'customer' ? customerTrend : shopTrend).set(
        point._id.period,
        point.count,
      );
    }
    const repairTrend = new Map(
      trendRepairs.map((point) => [point._id, point.count]),
    );
    const quotationTrend = new Map(
      trendQuotations.map((point) => [point._id, point.count]),
    );
    const trendPeriods = this.dashboardPeriods(
      from,
      endExclusive,
      bucketFormat === '%Y-%m',
    );
    const totalCategoryRequests = categoriesRaw.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const categories = categoriesRaw.slice(0, 8).map((item) => ({
      name: item._id || 'Unspecified',
      count: item.count,
      percentage: totalCategoryRequests
        ? Math.round((item.count / totalCategoryRequests) * 1000) / 10
        : 0,
    }));
    const subscriptionFinancials = await this.getSubscriptionFinancials(
      from,
      endExclusive,
      now,
    );
    const recentActivities = [
      ...recentRegistrationRecords.map((record) => ({
        id: String(record._id),
        type:
          record.accountType === 'shop'
            ? 'shop_registration'
            : 'customer_registration',
        description:
          record.accountType === 'shop'
            ? 'New repair shop registered'
            : 'New customer registered',
        relatedName:
          (record.accountType === 'shop'
            ? (record.shopDetails as { shopName?: string } | undefined)
                ?.shopName
            : formatUserName(record)) || null,
        createdAt: record.createdAt as Date,
        link: `/admin/users/${String(record._id)}`,
      })),
      ...recentAuditRecords.map((record) => ({
        id: String(record._id),
        type: String(record.action),
        description: String(record.action).replaceAll('_', ' '),
        relatedName: record.targetName as string,
        createdAt: record.createdAt as Date,
        link: `/admin/users/${String(record.targetUserId)}`,
      })),
      ...recentRepairRecords.map((record) => ({
        id: String(record._id),
        type: 'repair_request',
        description: 'New repair request submitted',
        relatedName: record.customerName as string,
        createdAt: record.createdAt as Date,
        link: '/admin#repair-analytics',
      })),
      ...recentQuotationRecords.flatMap((record) => {
        const submission = {
          id: `${String(record._id)}:submitted`,
          type: 'quotation',
          description: 'New quotation submitted',
          relatedName: record.shopName as string,
          createdAt: record.createdAt as Date,
          link: '/admin#quotation-analytics',
        };
        if (
          !record.respondedAt ||
          !['accepted', 'rejected'].includes(String(record.status))
        ) {
          return [submission];
        }
        return [
          submission,
          {
            id: `${String(record._id)}:responded`,
            type: 'quotation_response',
            description: `Quotation ${String(record.status)} by customer`,
            relatedName: record.shopName as string,
            createdAt: record.respondedAt as Date,
            link: '/admin#quotation-analytics',
          },
        ];
      }),
      ...subscriptionFinancials.activities,
    ]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, 12);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      users: {
        customers: {
          total: customerTotal,
          new: customerNew,
          previous: customerPrevious,
          changePercent: this.percentChange(customerNew, customerPrevious),
          active: lifecycleCount('customer', 'active'),
          inactive: lifecycleCount('customer', 'inactive'),
          suspended: lifecycleCount('customer', 'suspended'),
        },
        shops: {
          total: shopTotal,
          approved: getGroupedCount(shopApprovalGroups, 'approved'),
          pending: getGroupedCount(shopApprovalGroups, 'pending'),
          declined: getGroupedCount(shopApprovalGroups, 'declined'),
          new: shopNew,
          previous: shopPrevious,
          active: lifecycleCount('shop', 'active'),
          inactive: lifecycleCount('shop', 'inactive'),
          suspended: lifecycleCount('shop', 'suspended'),
        },
      },
      repairs: {
        total: repairTotal,
        new: repairNew,
        previous: repairPrevious,
        changePercent: this.percentChange(repairNew, repairPrevious),
        shared: repairShared,
        pendingShopResponses:
          getGroupedCount(shopResponseGroups, 'new') +
          getGroupedCount(shopResponseGroups, 'pending'),
        accepted: repairAccepted,
        declined: repairDeclined,
        expired: repairExpired,
        completed,
        completionRate: repairTotal
          ? Math.round((completed / repairTotal) * 1000) / 10
          : 0,
      },
      quotations: {
        total: quotationTotal,
        pending: pendingQuotations,
        accepted: acceptedQuotations,
        rejected: rejectedQuotations,
        expired: expiredQuotations,
        acceptanceRate:
          acceptedQuotations + rejectedQuotations
            ? Math.round(
                (acceptedQuotations /
                  (acceptedQuotations + rejectedQuotations)) *
                  1000,
              ) / 10
            : 0,
      },
      subscriptionFinancials: {
        currencyTotals: subscriptionFinancials.currencyTotals,
      },
      trends: trendPeriods.map((period) => ({
        period,
        customers: customerTrend.get(period) ?? 0,
        shops: shopTrend.get(period) ?? 0,
        repairs: repairTrend.get(period) ?? 0,
        quotations: quotationTrend.get(period) ?? 0,
      })),
      repairStatuses,
      quotationStatuses,
      categories,
      recentActivities,
      recentRegistrations: recentRegistrationRecords.map((record) => ({
        id: String(record._id),
        name:
          (record.accountType === 'shop'
            ? (record.shopDetails as { shopName?: string } | undefined)
                ?.shopName
            : formatUserName(record)) || 'New account',
        accountType: record.accountType as 'customer' | 'shop',
        createdAt: record.createdAt as Date,
      })),
      recentRepairs: recentRepairRecords.map((record) => ({
        id: String(record._id),
        customerId: String(record.customerId),
        customerName: record.customerName as string,
        appliance: record.appliance as string,
        description: record.description as string,
        createdAt: record.createdAt as Date,
        shopsNotified: Array.isArray(record.shopIds)
          ? record.shopIds.length
          : 0,
        status: record.status as string,
      })),
      topShops: topShopsRaw.map((shop) => ({
        id: shop._id.toString(),
        name: shop.name,
        location: [shop.city, shop.state].filter(Boolean).join(', '),
        accountStatus: shop.accountStatus,
        completedRepairs: shop.count,
      })),
    };
  }

  private async getSubscriptionFinancials(
    from: Date,
    endExclusive: Date,
    now: Date,
  ): Promise<{
    currencyTotals: Array<{
      currency: string;
      accountReceivableCents: number;
      overdueAmountCents: number;
      subscriptionRevenueCents: number;
    }>;
    activities: AdminSubscriptionActivity[];
  }> {
    const currentPeriod = { $gte: from, $lt: endExclusive };
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const [invoices, legacyPayments] = await Promise.all([
      this.subscriptionInvoices
        .find({
          $or: [
            { generatedAt: currentPeriod },
            { paidAt: currentPeriod },
            { dueAt: currentPeriod },
            { 'events.occurredAt': currentPeriod },
          ],
        })
        .select(
          'stripeInvoiceId registrationRequestId userId stripePaymentIntentId totalAmountCents amountPaidCents refundedAmountCents currency status billingReason dueAt generatedAt paidAt events refunds',
        )
        .lean()
        .exec(),
      this.registrationRequests
        .find({
          accountType: 'shop',
          paymentStatus: 'paid',
          paidAt: currentPeriod,
        })
        .select(
          '_id userId paymentAmountCents paymentRefundedAmountCents paymentCurrency paidAt stripeCheckoutInvoiceId',
        )
        .lean()
        .exec(),
    ]);

    const users = await this.users
      .find({
        _id: {
          $in: [
            ...new Map(
              [...invoices, ...legacyPayments].map((record) => [
                String(record.userId),
                record.userId,
              ]),
            ).values(),
          ],
        },
      })
      .select('_id shopDetails.shopName')
      .lean()
      .exec();
    const shopNames = new Map(
      users.map((user) => [
        String(user._id),
        user.shopDetails?.shopName ?? 'Repair shop',
      ]),
    );
    const totals = new Map<
      string,
      {
        currency: string;
        accountReceivableCents: number;
        overdueAmountCents: number;
        subscriptionRevenueCents: number;
      }
    >();
    const getTotals = (currencyInput: string) => {
      const currency = currencyInput.toUpperCase();
      let total = totals.get(currency);
      if (!total) {
        total = {
          currency,
          accountReceivableCents: 0,
          overdueAmountCents: 0,
          subscriptionRevenueCents: 0,
        };
        totals.set(currency, total);
      }
      return total;
    };
    const inRange = (value: Date | undefined): boolean =>
      Boolean(value && value >= from && value < endExclusive);
    const activities: AdminSubscriptionActivity[] = [];
    const activityDetails: Record<
      string,
      { type: string; description: string }
    > = {
      'invoice.finalized': {
        type: 'subscription_invoice_generated',
        description: 'Subscription Invoice Generated',
      },
      'invoice.paid': {
        type: 'subscription_payment_received',
        description: 'Subscription Payment Received',
      },
      'invoice.payment_failed': {
        type: 'subscription_payment_failed',
        description: 'Subscription Payment Failed',
      },
      'charge.refunded': {
        type: 'subscription_payment_refunded',
        description: 'Subscription Payment Refunded',
      },
    };
    const persistedInvoiceIds = new Set(
      invoices.map((invoice) => invoice.stripeInvoiceId),
    );
    const initialSubscriptionRegistrationIds = new Set(
      invoices
        .filter((invoice) => invoice.billingReason === 'subscription_create')
        .map((invoice) => String(invoice.registrationRequestId)),
    );

    for (const invoice of invoices) {
      const currency = invoice.currency.toUpperCase();
      const total = getTotals(currency);
      const hasPaidActivity = (invoice.events ?? []).some(
        (event) => event.type === 'invoice.paid' && inRange(event.occurredAt),
      );
      const isCancelled = ['void', 'cancelled', 'canceled', 'draft'].includes(
        invoice.status.toLowerCase(),
      );
      const outstanding = isCancelled
        ? 0
        : Math.max(0, invoice.totalAmountCents - invoice.amountPaidCents);

      if (inRange(invoice.generatedAt) && outstanding > 0) {
        total.accountReceivableCents += outstanding;
        if (invoice.dueAt && invoice.dueAt < todayStart) {
          total.overdueAmountCents += outstanding;
        }
      }
      if (
        invoice.status === 'paid' &&
        inRange(invoice.paidAt) &&
        invoice.amountPaidCents > 0
      ) {
        const totalRefunded = Math.max(
          invoice.refundedAmountCents ?? 0,
          (invoice.refunds ?? []).reduce(
            (sum, refund) => sum + refund.amountCents,
            0,
          ),
        );
        total.subscriptionRevenueCents += Math.max(
          0,
          invoice.amountPaidCents - totalRefunded,
        );
      }

      const shopName = shopNames.get(String(invoice.userId)) ?? 'Repair shop';
      for (const event of invoice.events ?? []) {
        if (!inRange(event.occurredAt)) {
          continue;
        }
        const details = activityDetails[event.type];
        if (details) {
          activities.push({
            id: event.eventId,
            ...details,
            relatedName: shopName,
            createdAt: event.occurredAt,
            link: `/admin/users/${String(invoice.userId)}`,
            amountCents: event.amountCents,
            currency,
            status: event.status,
          });
        }
      }

      if (
        invoice.status === 'paid' &&
        invoice.paidAt &&
        inRange(invoice.paidAt) &&
        invoice.amountPaidCents > 0 &&
        !hasPaidActivity
      ) {
        activities.push({
          id: `${invoice.stripeInvoiceId}:paid`,
          type: 'subscription_payment_received',
          description: 'Subscription Payment Received',
          relatedName: shopName,
          createdAt: invoice.paidAt,
          link: `/admin/users/${String(invoice.userId)}`,
          amountCents: invoice.amountPaidCents,
          currency,
          status: 'paid',
        });
      }

      if (
        !isCancelled &&
        outstanding > 0 &&
        invoice.dueAt &&
        invoice.dueAt < todayStart &&
        inRange(invoice.dueAt)
      ) {
        activities.push({
          id: `${invoice.stripeInvoiceId}:overdue`,
          type: 'subscription_payment_overdue',
          description: 'Subscription Payment Overdue',
          relatedName: shopName,
          createdAt: invoice.dueAt,
          link: `/admin/users/${String(invoice.userId)}`,
          amountCents: outstanding,
          currency,
          status: 'overdue',
        });
      }
    }

    for (const payment of legacyPayments) {
      const currency = (payment.paymentCurrency ?? 'usd').toUpperCase();
      const total = getTotals(currency);
      if (!payment.paidAt) {
        continue;
      }
      const hasPersistedInvoice = Boolean(
        (payment.stripeCheckoutInvoiceId &&
          persistedInvoiceIds.has(payment.stripeCheckoutInvoiceId)) ||
        initialSubscriptionRegistrationIds.has(String(payment._id)),
      );
      if (!hasPersistedInvoice && payment.paymentAmountCents !== undefined) {
        total.subscriptionRevenueCents += Math.max(
          0,
          payment.paymentAmountCents -
            (payment.paymentRefundedAmountCents ?? 0),
        );
      }
      activities.push({
        id: `shop-subscription-purchased:${String(payment._id)}`,
        type: 'shop_subscription_purchased',
        description: 'Shop Subscription Purchased',
        relatedName: shopNames.get(String(payment.userId)) ?? 'Repair shop',
        createdAt: payment.paidAt,
        link: `/admin/users/${String(payment.userId)}`,
        amountCents: payment.paymentAmountCents,
        currency,
        status: 'paid',
      });
    }

    return {
      currencyTotals: [...totals.values()].sort((left, right) =>
        left.currency.localeCompare(right.currency),
      ),
      activities,
    };
  }

  private parseDashboardDate(value: string, boundary: 'start' | 'end'): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Dashboard dates must use YYYY-MM-DD format',
      );
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Invalid dashboard date');
    }
    if (boundary === 'end') {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private dashboardPeriods(
    from: Date,
    endExclusive: Date,
    monthly: boolean,
  ): string[] {
    const periods: string[] = [];
    const cursor = new Date(from);
    if (monthly) {
      cursor.setUTCDate(1);
      while (cursor < endExclusive) {
        periods.push(cursor.toISOString().slice(0, 7));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } else {
      cursor.setUTCHours(0, 0, 0, 0);
      while (cursor < endExclusive) {
        periods.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return periods;
  }

  async getUsers(options: {
    page: number;
    limit: number;
    status?: string;
    approvalStatus?: string;
    accountType?: string;
    accountStatus?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: string;
    city?: string;
    state?: string;
    includeCustomersWithApprovalStatus?: boolean;
  }): Promise<RegistrationRequestPage> {
    const page = Math.max(1, options.page);
    const allowedLimits = [5, 10, 20, 25, 50, 100];
    if (!allowedLimits.includes(options.limit)) {
      throw new BadRequestException(
        'Page size must be 5, 10, 20, 25, 50, or 100',
      );
    }
    const limit = options.limit;
    const match: Record<string, unknown> = {
      accountType: { $in: ['customer', 'shop'] },
    };
    if (options.accountType && options.accountType !== 'all') {
      if (!['customer', 'shop'].includes(options.accountType)) {
        throw new BadRequestException('Invalid account type filter');
      }
      match['accountType'] = options.accountType;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'registration_requests',
          localField: '_id',
          foreignField: 'userId',
          as: 'registrationRequests',
        },
      },
      {
        $addFields: {
          registrationRequest: {
            $arrayElemAt: ['$registrationRequests', 0],
          },
        },
      },
      {
        $addFields: {
          computedRegistrationStatus: {
            $cond: [
              { $eq: ['$accountType', 'customer'] },
              'approved',
              {
                $ifNull: [
                  '$registrationRequest.registrationStatus',
                  {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $eq: ['$accountStatus', 'pending_approval'],
                          },
                          then: 'pending',
                        },
                        {
                          case: { $eq: ['$accountStatus', 'rejected'] },
                          then: 'declined',
                        },
                      ],
                      default: 'approved',
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          computedAccountStatus: {
            $ifNull: [
              '$accountLifecycleStatus',
              {
                $cond: [
                  { $eq: ['$accountStatus', 'active'] },
                  'active',
                  'inactive',
                ],
              },
            ],
          },
          registrationDate: {
            $cond: [
              { $eq: ['$accountType', 'customer'] },
              '$createdAt',
              { $ifNull: ['$registrationRequest.submittedAt', '$createdAt'] },
            ],
          },
          displayName: {
            $ifNull: [
              '$shopDetails.shopName',
              mongoUserDisplayName('$firstName', '$lastName', '$fullName'),
            ],
          },
        },
      },
    ];
    const approvalStatus = options.approvalStatus ?? options.status;
    if (approvalStatus && approvalStatus !== 'all') {
      if (!['pending', 'approved', 'declined'].includes(approvalStatus)) {
        throw new BadRequestException('Invalid registration status filter');
      }
      pipeline.push({
        $match:
          options.includeCustomersWithApprovalStatus &&
          options.accountType === 'all'
            ? {
                $or: [
                  { accountType: 'customer' },
                  { computedRegistrationStatus: approvalStatus },
                ],
              }
            : { computedRegistrationStatus: approvalStatus },
      });
    }
    if (options.accountStatus && options.accountStatus !== 'all') {
      if (
        !['active', 'inactive', 'suspended'].includes(options.accountStatus)
      ) {
        throw new BadRequestException('Invalid account status filter');
      }
      pipeline.push({
        $match: { computedAccountStatus: options.accountStatus },
      });
    }
    const locationConditions: Record<string, unknown>[] = [];
    for (const [field, value] of [
      ['shopDetails.city', options.city],
      ['shopDetails.state', options.state],
    ] as const) {
      const locationSearch = value?.trim();
      if (locationSearch) {
        locationConditions.push({
          [field]: {
            $regex: locationSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            $options: 'i',
          },
        });
      }
    }
    if (locationConditions.length) {
      pipeline.push({
        $match: {
          $and: [{ accountType: 'shop' }, ...locationConditions],
        },
      });
    }
    const search = options.search?.trim();
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions: Record<string, unknown>[] = [
        { fullName: { $regex: escapedSearch, $options: 'i' } },
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { 'shopDetails.shopName': { $regex: escapedSearch, $options: 'i' } },
        { 'shopDetails.address': { $regex: escapedSearch, $options: 'i' } },
        { 'shopDetails.city': { $regex: escapedSearch, $options: 'i' } },
        { 'shopDetails.state': { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { countryCode: { $regex: escapedSearch, $options: 'i' } },
        { mobileNumber: { $regex: escapedSearch, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$countryCode', ''] },
                  ' ',
                  { $ifNull: ['$mobileNumber', ''] },
                ],
              },
              regex: escapedSearch,
              options: 'i',
            },
          },
        },
      ];
      if (isObjectIdOrHexString(search)) {
        searchConditions.push({ _id: new Types.ObjectId(search) });
      }
      pipeline.push({ $match: { $or: searchConditions } });
    }
    const dateMatch: Record<string, Date> = {};
    if (options.fromDate) {
      const fromDate = new Date(options.fromDate);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid registration start date');
      }
      dateMatch.$gte = fromDate;
    }
    if (options.toDate) {
      const toDate = new Date(options.toDate);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid registration end date');
      }
      toDate.setHours(23, 59, 59, 999);
      dateMatch.$lte = toDate;
    }
    if (
      dateMatch.$gte &&
      dateMatch.$lte &&
      dateMatch.$gte.getTime() > dateMatch.$lte.getTime()
    ) {
      throw new BadRequestException(
        'Registration start date must be before end date',
      );
    }
    if (Object.keys(dateMatch).length) {
      pipeline.push({ $match: { registrationDate: dateMatch } });
    }
    const sortBy = options.sortBy ?? 'registrationDate';
    const sortField =
      sortBy === 'name'
        ? 'displayName'
        : sortBy === 'status'
          ? 'computedRegistrationStatus'
          : sortBy === 'registrationDate'
            ? 'registrationDate'
            : null;
    if (!sortField) {
      throw new BadRequestException('Invalid user sort field');
    }
    const sortOrder = options.sortOrder ?? 'desc';
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('Invalid sort order');
    }
    pipeline.push(
      {
        $sort: {
          [sortField]: sortOrder === 'asc' ? 1 : -1,
          _id: sortOrder === 'asc' ? 1 : -1,
        },
      },
      {
        $facet: {
          requests: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                userId: '$_id',
                registrationRequestId: {
                  $cond: [
                    { $eq: ['$accountType', 'shop'] },
                    '$registrationRequest._id',
                    null,
                  ],
                },
                registrationNumber: {
                  $cond: [
                    { $eq: ['$accountType', 'shop'] },
                    '$registrationRequest.registrationNumber',
                    '',
                  ],
                },
                applicantName: mongoUserDisplayName(
                  '$firstName',
                  '$lastName',
                  '$fullName',
                ),
                shopName: '$shopDetails.shopName',
                businessType: '$shopDetails.businessType',
                businessAddress: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ['$shopDetails.address', ''] },
                        {
                          $cond: [
                            { $eq: ['$shopDetails.landmark', ''] },
                            '',
                            {
                              $concat: [
                                ', ',
                                { $ifNull: ['$shopDetails.landmark', ''] },
                              ],
                            },
                          ],
                        },
                        {
                          $cond: [
                            { $eq: ['$shopDetails.city', ''] },
                            '',
                            {
                              $concat: [
                                ', ',
                                { $ifNull: ['$shopDetails.city', ''] },
                              ],
                            },
                          ],
                        },
                        {
                          $cond: [
                            { $eq: ['$shopDetails.state', ''] },
                            '',
                            {
                              $concat: [
                                ', ',
                                { $ifNull: ['$shopDetails.state', ''] },
                              ],
                            },
                          ],
                        },
                        {
                          $cond: [
                            { $eq: ['$shopDetails.postalCode', ''] },
                            '',
                            {
                              $concat: [
                                ', ',
                                { $ifNull: ['$shopDetails.postalCode', ''] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
                services: { $ifNull: ['$shopDetails.services', []] },
                city: { $ifNull: ['$shopDetails.city', ''] },
                state: { $ifNull: ['$shopDetails.state', ''] },
                email: 1,
                countryCode: 1,
                mobileNumber: 1,
                accountType: 1,
                accountStatus: '$computedAccountStatus',
                registrationStatus: '$computedRegistrationStatus',
                approvalStatus: '$computedRegistrationStatus',
                paymentStatus: {
                  $ifNull: [
                    '$registrationRequest.paymentStatus',
                    'not_required',
                  ],
                },
                subscriptionPlan: {
                  $cond: [
                    { $eq: ['$accountType', 'shop'] },
                    'Fixroa Shop monthly subscription',
                    null,
                  ],
                },
                paymentAmountCents: {
                  $ifNull: [
                    '$registrationRequest.paymentAmountCents',
                    {
                      $cond: [{ $eq: ['$accountType', 'shop'] }, 2900, null],
                    },
                  ],
                },
                paymentCurrency: {
                  $ifNull: [
                    '$registrationRequest.paymentCurrency',
                    {
                      $cond: [{ $eq: ['$accountType', 'shop'] }, 'usd', null],
                    },
                  ],
                },
                paidAt: { $ifNull: ['$registrationRequest.paidAt', null] },
                submittedAt: '$registrationDate',
                reviewedAt: {
                  $ifNull: ['$registrationRequest.reviewedAt', null],
                },
                declineReason: {
                  $ifNull: ['$registrationRequest.declineReason', null],
                },
                latitude: {
                  $ifNull: [
                    '$shopDetails.location.latitude',
                    '$location.latitude',
                  ],
                },
                longitude: {
                  $ifNull: [
                    '$shopDetails.location.longitude',
                    '$location.longitude',
                  ],
                },
              },
            },
          ],
          metadata: [{ $count: 'total' }],
        },
      },
    );

    const [result] = await this.users
      .aggregate<AggregatedRegistrationRequest>(pipeline)
      .exec();
    const total = result?.metadata?.[0]?.total ?? 0;
    return {
      requests: (result?.requests ?? []).map((request) =>
        this.toAdminRegistrationRequest(request),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMapData(options: {
    type?: string;
    mapOnly?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    state?: string;
    from?: string;
    to?: string;
    status?: string;
    approvalStatus?: string;
  }): Promise<AdminMapData> {
    const type = options.type ?? 'all';
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    if (!['all', 'customers', 'shops', 'requests'].includes(type)) {
      throw new BadRequestException('Invalid map entity filter');
    }
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      ![10, 20, 25, 50, 100].includes(limit)
    ) {
      throw new BadRequestException('Invalid map pagination');
    }
    if (
      options.status &&
      options.status !== 'all' &&
      ![
        'active',
        'pending',
        ...REPAIR_JOB_STATUSES,
        ...LEGACY_REPAIR_JOB_STATUSES,
        'cancelled',
      ].includes(options.status)
    ) {
      throw new BadRequestException('Invalid repair status filter');
    }
    if (
      options.approvalStatus &&
      !['all', 'pending', 'approved', 'declined'].includes(
        options.approvalStatus,
      )
    ) {
      throw new BadRequestException('Invalid shop approval filter');
    }

    const start = options.from
      ? this.parseDashboardDate(options.from, 'start')
      : undefined;
    const end = options.to
      ? this.parseDashboardDate(options.to, 'end')
      : undefined;
    if (start && end && start.getTime() > end.getTime()) {
      throw new BadRequestException('Start date must be before end date');
    }
    if (
      start &&
      end &&
      end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException('Map date range cannot exceed 366 days');
    }
    const userDateMatch: Record<string, Date> = {
      ...(start ? { $gte: start } : {}),
      ...(end ? { $lte: end } : {}),
    };
    const requestMatch: Record<string, unknown> = {
      ...(Object.keys(userDateMatch).length
        ? { createdAt: userDateMatch }
        : {}),
    };

    const counts = {
      customers: 0,
      shops: 0,
      requests: 0,
      active: 0,
      completed: 0,
      disputed: 0,
    };
    if (!options.mapOnly) {
      const [userGroups, requestGroups] = await Promise.all([
        this.users
          .aggregate<{ _id: string; count: number }>([
            {
              $match: {
                accountType: { $in: ['customer', 'shop'] },
                ...(Object.keys(userDateMatch).length
                  ? { createdAt: userDateMatch }
                  : {}),
              },
            },
            { $group: { _id: '$accountType', count: { $sum: 1 } } },
          ])
          .exec(),
        this.repairRequests
          .aggregate<{ _id: string; count: number }>([
            { $match: requestMatch },
            {
              $addFields: {
                mapStatus: {
                  $ifNull: [
                    '$repairJob.status',
                    {
                      $cond: [
                        { $eq: ['$status', 'open'] },
                        'pending',
                        '$status',
                      ],
                    },
                  ],
                },
              },
            },
            { $group: { _id: '$mapStatus', count: { $sum: 1 } } },
          ])
          .exec(),
      ]);
      const userCounts = new Map(
        userGroups.map((group) => [group._id, group.count]),
      );
      const requestCounts = new Map(
        requestGroups.map((group) => [group._id, group.count]),
      );
      Object.assign(counts, {
        customers: userCounts.get('customer') ?? 0,
        shops: userCounts.get('shop') ?? 0,
        requests: [...requestCounts.values()].reduce(
          (total, count) => total + count,
          0,
        ),
        active: [...requestCounts.entries()]
          .filter(
            ([status]) => !NON_ACTIVE_MAP_REPAIR_STATUSES.includes(status),
          )
          .reduce((total, [, count]) => total + count, 0),
        completed: requestCounts.get('completed') ?? 0,
        disputed: requestCounts.get('disputed') ?? 0,
      });
    }
    const entities: AdminMapEntity[] = [];
    let total = 0;

    const showUserMarkers = type !== 'requests';
    const showRequestMarkers = type === 'all' || type === 'requests';

    if (showUserMarkers) {
      const usersPage = await this.getUsers({
        page,
        limit,
        accountType:
          type === 'customers' ? 'customer' : type === 'shops' ? 'shop' : 'all',
        accountStatus: 'all',
        approvalStatus: options.approvalStatus ?? 'all',
        includeCustomersWithApprovalStatus: type === 'all',
        search: options.search,
        fromDate: options.from,
        toDate: options.to,
        city: type === 'customers' ? undefined : options.city,
        state: type === 'customers' ? undefined : options.state,
      });
      total += usersPage.total;
      const pageUsers = usersPage.requests;
      const ids = pageUsers.map((user) => new Types.ObjectId(user.userId));
      const stats = ids.length
        ? await this.repairRequests
            .aggregate<{
              customers: Array<{
                _id: Types.ObjectId;
                total: number;
                active: number;
                completed: number;
              }>;
              shops: Array<{
                _id: Types.ObjectId;
                total: number;
                active: number;
                completed: number;
              }>;
            }>([
              {
                $match: {
                  $or: [
                    { customerId: { $in: ids } },
                    { shopIds: { $in: ids } },
                  ],
                },
              },
              {
                $addFields: {
                  mapStatus: {
                    $ifNull: [
                      '$repairJob.status',
                      {
                        $cond: [
                          { $eq: ['$status', 'open'] },
                          'pending',
                          '$status',
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $facet: {
                  customers: [
                    { $match: { customerId: { $in: ids } } },
                    {
                      $group: {
                        _id: '$customerId',
                        total: { $sum: 1 },
                        active: {
                          $sum: {
                            $cond: [
                              {
                                $not: [
                                  {
                                    $in: [
                                      '$mapStatus',
                                      [
                                        'pending',
                                        'completed',
                                        'repair_declined',
                                        'disputed',
                                        'cancelled',
                                      ],
                                    ],
                                  },
                                ],
                              },
                              1,
                              0,
                            ],
                          },
                        },
                        completed: {
                          $sum: {
                            $cond: [{ $eq: ['$mapStatus', 'completed'] }, 1, 0],
                          },
                        },
                      },
                    },
                  ],
                  shops: [
                    { $unwind: '$shopIds' },
                    { $match: { shopIds: { $in: ids } } },
                    {
                      $group: {
                        _id: '$shopIds',
                        total: { $sum: 1 },
                        active: {
                          $sum: {
                            $cond: [
                              {
                                $not: [
                                  {
                                    $in: [
                                      '$mapStatus',
                                      [
                                        'pending',
                                        'completed',
                                        'repair_declined',
                                        'disputed',
                                        'cancelled',
                                      ],
                                    ],
                                  },
                                ],
                              },
                              1,
                              0,
                            ],
                          },
                        },
                        completed: {
                          $sum: {
                            $cond: [{ $eq: ['$mapStatus', 'completed'] }, 1, 0],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ])
            .exec()
        : [];
      const statsById = new Map<string, AdminMapEntity['repairCounts']>();
      for (const [kind, records] of [
        ['customer', stats[0]?.customers ?? []],
        ['shop', stats[0]?.shops ?? []],
      ] as const) {
        records.forEach((record) => {
          statsById.set(`${kind}:${record._id.toString()}`, {
            total: record.total,
            active: record.active,
            completed: record.completed,
          });
        });
      }
      entities.push(
        ...pageUsers.map((user): AdminMapEntity => {
          const isShop = user.accountType === 'shop';
          const location =
            user.latitude !== null &&
            user.longitude !== null &&
            Number.isFinite(user.latitude) &&
            Number.isFinite(user.longitude) &&
            Math.abs(user.latitude) <= 90 &&
            Math.abs(user.longitude) <= 180
              ? { latitude: user.latitude, longitude: user.longitude }
              : null;
          return {
            id: user.userId,
            type: isShop ? 'shop' : 'customer',
            name: isShop
              ? (user.shopName ?? user.applicantName)
              : user.applicantName,
            ownerName: user.applicantName,
            location,
            address: user.businessAddress ?? '',
            city: user.city,
            state: user.state,
            email: user.email,
            phone: `${user.countryCode} ${user.mobileNumber}`.trim(),
            status: user.registrationStatus,
            accountStatus: user.accountStatus,
            approvalStatus: user.registrationStatus,
            repairCounts: statsById.get(
              `${isShop ? 'shop' : 'customer'}:${user.userId}`,
            ) ?? { total: 0, active: 0, completed: 0 },
          };
        }),
      );
    }

    if (showRequestMarkers) {
      const requestPipeline: PipelineStage[] = [
        { $match: requestMatch },
        {
          $addFields: {
            assignedQuotationId: {
              $ifNull: [
                '$repairJob.acceptedQuotationId',
                '$acceptedQuotationId',
              ],
            },
            mapStatus: {
              $ifNull: [
                '$repairJob.status',
                {
                  $cond: [{ $eq: ['$status', 'open'] }, 'pending', '$status'],
                },
              ],
            },
          },
        },
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
                  email: 1,
                  countryCode: 1,
                  mobileNumber: 1,
                  location: 1,
                },
              },
            ],
            as: 'mapCustomer',
          },
        },
        { $unwind: { path: '$mapCustomer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'repair_quotations',
            localField: 'assignedQuotationId',
            foreignField: '_id',
            pipeline: [{ $project: { shopId: 1, amount: 1, currency: 1 } }],
            as: 'mapQuotation',
          },
        },
        {
          $unwind: { path: '$mapQuotation', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'mapQuotation.shopId',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  fullName: 1,
                  email: 1,
                  countryCode: 1,
                  mobileNumber: 1,
                  shopDetails: 1,
                },
              },
            ],
            as: 'mapShop',
          },
        },
        { $unwind: { path: '$mapShop', preserveNullAndEmptyArrays: true } },
      ];
      const status = options.status?.trim();
      if (status && status !== 'all') {
        if (
          ![
            'active',
            'pending',
            ...REPAIR_JOB_STATUSES,
            ...LEGACY_REPAIR_JOB_STATUSES,
            'cancelled',
          ].includes(status)
        ) {
          throw new BadRequestException('Invalid repair status filter');
        }
        requestPipeline.push(
          status === 'active'
            ? {
                $match: {
                  mapStatus: { $nin: NON_ACTIVE_MAP_REPAIR_STATUSES },
                },
              }
            : { $match: { mapStatus: status } },
        );
      }
      const locationMatch: Record<string, unknown>[] = [];
      for (const [field, value] of [
        ['mapShop.shopDetails.city', options.city],
        ['mapShop.shopDetails.state', options.state],
      ] as const) {
        if (value?.trim()) {
          locationMatch.push({
            [field]: {
              $regex: value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          });
        }
      }
      if (locationMatch.length) {
        requestPipeline.push({ $match: { $and: locationMatch } });
      }
      const search = options.search?.trim();
      if (search) {
        const expression = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requestCode = search.replace(/^#/, '');
        const conditions: Record<string, unknown>[] = [
          { appliance: { $regex: expression, $options: 'i' } },
          { description: { $regex: expression, $options: 'i' } },
          { 'mapCustomer.firstName': { $regex: expression, $options: 'i' } },
          { 'mapCustomer.lastName': { $regex: expression, $options: 'i' } },
          { 'mapCustomer.fullName': { $regex: expression, $options: 'i' } },
          { 'mapCustomer.email': { $regex: expression, $options: 'i' } },
          {
            'mapShop.shopDetails.shopName': {
              $regex: expression,
              $options: 'i',
            },
          },
          {
            'mapShop.shopDetails.address': {
              $regex: expression,
              $options: 'i',
            },
          },
          { 'mapShop.shopDetails.city': { $regex: expression, $options: 'i' } },
          {
            'mapShop.shopDetails.state': { $regex: expression, $options: 'i' },
          },
        ];
        if (isObjectIdOrHexString(requestCode)) {
          conditions.push({ _id: new Types.ObjectId(requestCode) });
        }
        if (/^[0-9a-f]{8}$/i.test(requestCode)) {
          const requestCodePattern = requestCode.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          );
          requestPipeline.push({
            $addFields: { mapRequestIdText: { $toString: '$_id' } },
          });
          conditions.push({
            mapRequestIdText: {
              $regex: `${requestCodePattern}$`,
              $options: 'i',
            },
          });
        }
        requestPipeline.push({ $match: { $or: conditions } });
      }
      if (options.mapOnly) {
        requestPipeline.push(
          { $sort: { createdAt: -1, _id: -1 } },
          {
            $project: {
              _id: 1,
              appliance: 1,
              mapStatus: 1,
              customerLatitude: 1,
              customerLongitude: 1,
              customerLocation: '$mapCustomer.location',
            },
          },
        );
        const records = await this.repairRequests
          .aggregate<Record<string, unknown>>(requestPipeline)
          .exec();
        const markers = records.flatMap((record): AdminMapMarker[] => {
          const requestLatitude = record['customerLatitude'];
          const requestLongitude = record['customerLongitude'];
          const customerLocation = record['customerLocation'] as
            { latitude?: number; longitude?: number } | null | undefined;
          const hasRequestLocation =
            typeof requestLatitude === 'number' &&
            Number.isFinite(requestLatitude) &&
            Math.abs(requestLatitude) <= 90 &&
            typeof requestLongitude === 'number' &&
            Number.isFinite(requestLongitude) &&
            Math.abs(requestLongitude) <= 180;
          const latitude = hasRequestLocation
            ? requestLatitude
            : customerLocation?.latitude;
          const longitude = hasRequestLocation
            ? requestLongitude
            : customerLocation?.longitude;
          if (
            typeof latitude !== 'number' ||
            !Number.isFinite(latitude) ||
            Math.abs(latitude) > 90 ||
            typeof longitude !== 'number' ||
            !Number.isFinite(longitude) ||
            Math.abs(longitude) > 180
          ) {
            return [];
          }
          return [
            {
              id: String(record['_id']),
              type: 'request',
              name: String(record['appliance'] ?? 'Repair request'),
              status: String(record['mapStatus'] ?? 'pending'),
              location: { latitude, longitude },
            },
          ];
        });
        return {
          counts,
          entities: [],
          markers,
          page: 1,
          limit: markers.length,
          total: markers.length,
        };
      }
      requestPipeline.push(
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $facet: {
            entities: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  appliance: 1,
                  serviceType: 1,
                  description: 1,
                  createdAt: 1,
                  mapStatus: 1,
                  customerLatitude: 1,
                  customerLongitude: 1,
                  customerLocation: '$mapCustomer.location',
                  customerName: mongoUserDisplayName(
                    '$mapCustomer.firstName',
                    '$mapCustomer.lastName',
                    '$mapCustomer.fullName',
                    'Customer',
                  ),
                  customerEmail: '$mapCustomer.email',
                  customerPhone: {
                    $concat: [
                      { $ifNull: ['$mapCustomer.countryCode', ''] },
                      ' ',
                      { $ifNull: ['$mapCustomer.mobileNumber', ''] },
                    ],
                  },
                  shopName: '$mapShop.shopDetails.shopName',
                  shopAddress: '$mapShop.shopDetails.address',
                  shopEmail: '$mapShop.email',
                  shopPhone: {
                    $concat: [
                      { $ifNull: ['$mapShop.countryCode', ''] },
                      ' ',
                      { $ifNull: ['$mapShop.mobileNumber', ''] },
                    ],
                  },
                  shopCity: '$mapShop.shopDetails.city',
                  shopState: '$mapShop.shopDetails.state',
                  shopLocation: '$mapShop.shopDetails.location',
                  quotationAmount: '$mapQuotation.amount',
                  quotationCurrency: '$mapQuotation.currency',
                },
              },
            ],
            metadata: [{ $count: 'total' }],
          },
        },
      );
      const [result] = await this.repairRequests
        .aggregate<{
          entities: Array<Record<string, unknown>>;
          metadata: Array<{ total: number }>;
        }>(requestPipeline)
        .exec();
      const requestEntities = result?.entities ?? [];
      const requestTotal = result?.metadata[0]?.total ?? 0;
      if (type === 'requests' || (type === 'all' && !showUserMarkers)) {
        total = requestTotal;
      } else {
        total += requestTotal;
      }
      entities.push(
        ...requestEntities.map((record): AdminMapEntity => {
          const requestLatitude = record['customerLatitude'];
          const requestLongitude = record['customerLongitude'];
          const customerLocation = record['customerLocation'] as
            { latitude?: number; longitude?: number } | null | undefined;
          const hasRequestLocation =
            typeof requestLatitude === 'number' &&
            Number.isFinite(requestLatitude) &&
            Math.abs(requestLatitude) <= 90 &&
            typeof requestLongitude === 'number' &&
            Number.isFinite(requestLongitude) &&
            Math.abs(requestLongitude) <= 180;
          const customerLatitude = hasRequestLocation
            ? requestLatitude
            : customerLocation?.latitude;
          const customerLongitude = hasRequestLocation
            ? requestLongitude
            : customerLocation?.longitude;
          const shopLocation = record['shopLocation'] as
            { latitude?: number; longitude?: number } | null | undefined;
          const validLocation =
            typeof customerLatitude === 'number' &&
            Number.isFinite(customerLatitude) &&
            Math.abs(customerLatitude) <= 90 &&
            typeof customerLongitude === 'number' &&
            Number.isFinite(customerLongitude) &&
            Math.abs(customerLongitude) <= 180;
          const validShopLocation =
            typeof shopLocation?.latitude === 'number' &&
            Number.isFinite(shopLocation.latitude) &&
            Math.abs(shopLocation.latitude) <= 90 &&
            typeof shopLocation.longitude === 'number' &&
            Number.isFinite(shopLocation.longitude) &&
            Math.abs(shopLocation.longitude) <= 180;
          return {
            id: String(record['_id']),
            type: 'request',
            name: String(record['appliance'] ?? 'Repair request'),
            location: validLocation
              ? {
                  latitude: customerLatitude!,
                  longitude: customerLongitude!,
                }
              : null,
            address: '',
            city: '',
            state: '',
            email: String(record['customerEmail'] ?? ''),
            phone: String(record['customerPhone'] ?? '').trim(),
            status: String(record['mapStatus'] ?? 'pending'),
            customerName: String(record['customerName'] ?? 'Customer'),
            customerEmail: String(record['customerEmail'] ?? ''),
            customerPhone: String(record['customerPhone'] ?? '').trim(),
            shopName: String(record['shopName'] ?? ''),
            shopAddress: String(record['shopAddress'] ?? ''),
            shopCity: String(record['shopCity'] ?? ''),
            shopState: String(record['shopState'] ?? ''),
            shopEmail: String(record['shopEmail'] ?? ''),
            shopPhone: String(record['shopPhone'] ?? '').trim(),
            shopLocation: validShopLocation
              ? {
                  latitude: shopLocation!.latitude!,
                  longitude: shopLocation!.longitude!,
                }
              : null,
            appliance: String(record['appliance'] ?? ''),
            serviceType: String(record['serviceType'] ?? ''),
            description: String(record['description'] ?? ''),
            createdAt: record['createdAt'] as Date,
            quotationAmount:
              typeof record['quotationAmount'] === 'number'
                ? record['quotationAmount']
                : null,
            quotationCurrency:
              typeof record['quotationCurrency'] === 'string'
                ? record['quotationCurrency']
                : null,
          };
        }),
      );
    }
    return { counts, entities, page, limit, total };
  }

  async getMapRequest(requestId: string): Promise<AdminMapEntity> {
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request not found');
    }
    const result = await this.getMapData({
      type: 'requests',
      page: 1,
      limit: 20,
      search: requestId,
    });
    const request = result.entities.find((entity) => entity.id === requestId);
    if (!request) throw new NotFoundException('Repair request not found');
    return request;
  }

  async getUserStatistics(): Promise<AdminUserStatistics> {
    const groups = await this.users
      .aggregate<{
        _id: {
          accountType: string;
          approvalStatus: string;
          accountStatus: string;
        };
        count: number;
      }>([
        { $match: { accountType: { $in: ['customer', 'shop'] } } },
        {
          $lookup: {
            from: 'registration_requests',
            localField: '_id',
            foreignField: 'userId',
            as: 'registrationRequests',
          },
        },
        {
          $addFields: {
            registrationRequest: { $arrayElemAt: ['$registrationRequests', 0] },
          },
        },
        {
          $addFields: {
            approvalStatus: {
              $cond: [
                { $eq: ['$accountType', 'customer'] },
                'approved',
                {
                  $ifNull: [
                    '$registrationRequest.registrationStatus',
                    {
                      $switch: {
                        branches: [
                          {
                            case: {
                              $eq: ['$accountStatus', 'pending_approval'],
                            },
                            then: 'pending',
                          },
                          {
                            case: { $eq: ['$accountStatus', 'rejected'] },
                            then: 'declined',
                          },
                        ],
                        default: 'approved',
                      },
                    },
                  ],
                },
              ],
            },
            accountLifecycleStatus: {
              $ifNull: [
                '$accountLifecycleStatus',
                {
                  $cond: [
                    { $eq: ['$accountStatus', 'active'] },
                    'active',
                    'inactive',
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              accountType: '$accountType',
              approvalStatus: '$approvalStatus',
              accountStatus: '$accountLifecycleStatus',
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    const statistics: AdminUserStatistics = {
      totalUsers: 0,
      totalCustomers: 0,
      totalRepairShops: 0,
      pendingApprovals: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      suspendedUsers: 0,
    };
    for (const group of groups ?? []) {
      statistics.totalUsers += group.count;
      if (group._id.accountType === 'customer') {
        statistics.totalCustomers += group.count;
      } else if (group._id.accountType === 'shop') {
        statistics.totalRepairShops += group.count;
      }
      if (group._id.approvalStatus === 'pending') {
        statistics.pendingApprovals += group.count;
      }
      if (group._id.accountStatus === 'active') {
        statistics.activeUsers += group.count;
      } else if (group._id.accountStatus === 'suspended') {
        statistics.suspendedUsers += group.count;
      } else if (group._id.accountStatus === 'inactive') {
        statistics.inactiveUsers += group.count;
      }
    }
    return statistics;
  }

  async getUserDetails(id: string): Promise<AdminUserDetails> {
    const user = await this.usersService.findById(id);
    if (
      !user ||
      (user.accountType !== 'customer' && user.accountType !== 'shop')
    ) {
      throw new NotFoundException('User account not found');
    }

    const registration =
      user.accountType === 'shop'
        ? await this.registrationRequests
            .findOne({ userId: user._id, accountType: 'shop' })
            .exec()
        : null;
    const shop = user.accountType === 'shop' ? user.shopDetails : undefined;
    const location = shop?.location ?? user.location;
    const requestRecords = await this.repairRequests
      .find(
        user.accountType === 'customer'
          ? { customerId: user._id }
          : { shopIds: user._id },
      )
      .select(
        '_id appliance description status acceptedQuotationId repairJob.status repairJob.acceptedQuotationId createdAt preferredServiceDate',
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    const repairRequestIds = requestRecords.map((record) => record._id);
    const quotationRecords =
      user.accountType === 'customer' && repairRequestIds.length === 0
        ? []
        : await this.repairQuotations
            .find(
              user.accountType === 'customer'
                ? { repairRequestId: { $in: repairRequestIds } }
                : { shopId: user._id },
            )
            .select(
              '_id repairRequestId amount currency status createdAt validUntil',
            )
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
            .exec();
    const activeQuotationIds = new Set(
      quotationRecords
        .filter((record) => record.status === 'accepted')
        .map((record) => record._id.toString()),
    );
    const hasAssignedRepair = (
      record: (typeof requestRecords)[number],
    ): boolean =>
      Boolean(
        record.repairJob?.status &&
        (user.accountType === 'customer' ||
          activeQuotationIds.has(
            record.repairJob.acceptedQuotationId?.toString() ?? '',
          )),
      );
    const isActiveRepair = (record: (typeof requestRecords)[number]): boolean =>
      hasAssignedRepair(record) &&
      !['completed', 'repair_declined'].includes(
        record.repairJob?.status ?? '',
      );
    const repairActivityStatus = (
      record: (typeof requestRecords)[number],
    ): string => {
      if (isActiveRepair(record)) {
        return 'active';
      }
      if (
        hasAssignedRepair(record) &&
        record.repairJob?.status === 'completed'
      ) {
        return 'completed';
      }
      return record.status;
    };
    const approvalStatus =
      user.accountType === 'customer'
        ? 'approved'
        : (registration?.registrationStatus ??
          (user.accountStatus === 'pending_approval'
            ? 'pending'
            : user.accountStatus === 'rejected'
              ? 'declined'
              : 'approved'));

    return {
      id: user._id.toString(),
      ...userNameParts(user),
      email: user.email,
      countryCode: user.countryCode ?? '',
      mobileNumber: user.mobileNumber ?? '',
      accountType: user.accountType,
      accountStatus:
        user.accountLifecycleStatus ??
        (user.accountStatus === 'active' ? 'active' : 'inactive'),
      approvalStatus,
      profileImageUrl: user.profileImageData ?? null,
      createdAt: user.createdAt,
      location: location
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
      shop: shop
        ? {
            shopName: shop.shopName,
            businessType: shop.businessType,
            description: shop.description,
            yearsOfExperience: shop.yearsOfExperience,
            address: shop.address,
            street: shop.street ?? '',
            area: shop.area ?? '',
            city: shop.city,
            state: shop.state,
            country: shop.country ?? '',
            postalCode: shop.postalCode,
            landmark: shop.landmark,
            services: shop.services,
          }
        : null,
      registration: registration
        ? {
            registrationNumber: registration.registrationNumber,
            status: registration.registrationStatus,
            submittedAt: registration.submittedAt,
            reviewedAt: registration.reviewedAt ?? null,
            declineReason: registration.declineReason ?? null,
            adminRemarks: registration.adminRemarks ?? null,
            paymentStatus: registration.paymentStatus,
            paymentAmountCents: registration.paymentAmountCents ?? null,
            paymentCurrency: registration.paymentCurrency ?? null,
            paidAt: registration.paidAt ?? null,
          }
        : null,
      repairActivity: requestRecords.map((record) => ({
        id: record._id.toString(),
        appliance: record.appliance,
        description: record.description,
        status: repairActivityStatus(record),
        repairStatus: hasAssignedRepair(record)
          ? (record.repairJob?.status ?? null)
          : null,
        createdAt: record.createdAt,
        preferredServiceDate: record.preferredServiceDate ?? null,
      })),
      quotationActivity: quotationRecords.map((record) => ({
        id: record._id.toString(),
        repairRequestId: record.repairRequestId.toString(),
        amount: record.amount,
        currency: record.currency,
        status: record.status,
        createdAt: record.createdAt,
        validUntil: record.validUntil ?? null,
      })),
    };
  }

  async getUserActivity(id: string): Promise<AdminUserActivity[]> {
    if (!isObjectIdOrHexString(id)) {
      throw new NotFoundException('User account not found');
    }
    const logs = await this.auditLogs
      .find({ targetUserId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return logs.map((log) => ({
      id: log._id.toString(),
      adminUserId: log.adminUserId.toString(),
      action: log.action,
      previousApprovalStatus: log.previousApprovalStatus,
      newApprovalStatus: log.newApprovalStatus,
      previousAccountStatus: log.previousAccountStatus,
      newAccountStatus: log.newAccountStatus,
      reason: log.reason ?? null,
      createdAt: log.createdAt,
    }));
  }

  async updateUserStatus(
    id: string,
    adminId: string,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string,
  ): Promise<{ accountStatus: 'active' | 'inactive' | 'suspended' }> {
    if (!isObjectIdOrHexString(id) || !isObjectIdOrHexString(adminId)) {
      throw new NotFoundException('User account not found');
    }
    const normalizedReason = reason?.trim();
    if (status === 'suspended' && !normalizedReason) {
      throw new BadRequestException(
        'A reason is required to suspend an account',
      );
    }

    const targetUserId = new Types.ObjectId(id);
    const adminUserId = new Types.ObjectId(adminId);
    const session = await this.connection.startSession();
    let previousStatus: string | undefined;
    let approvalStatus: string | undefined;
    let accountType: 'customer' | 'shop' | undefined;
    try {
      await session.withTransaction(async () => {
        const user = await this.users
          .findById(targetUserId)
          .session(session)
          .exec();
        if (
          !user ||
          (user.accountType !== 'customer' && user.accountType !== 'shop')
        ) {
          throw new NotFoundException('User account not found');
        }
        if (user._id.toString() === adminId) {
          throw new ConflictException(
            'Administrators cannot change their own account status',
          );
        }

        const registration =
          user.accountType === 'shop'
            ? await this.registrationRequests
                .findOne({ userId: targetUserId, accountType: 'shop' })
                .session(session)
                .exec()
            : null;
        approvalStatus =
          user.accountType === 'customer'
            ? 'approved'
            : (registration?.registrationStatus ??
              (user.accountStatus === 'pending_approval'
                ? 'pending'
                : user.accountStatus === 'rejected'
                  ? 'declined'
                  : 'approved'));
        const currentLifecycleStatus =
          user.accountLifecycleStatus ??
          (user.accountStatus === 'active' ? 'active' : 'inactive');
        if (
          approvalStatus !== 'approved' ||
          !['active', 'inactive', 'suspended'].includes(currentLifecycleStatus)
        ) {
          throw new ConflictException(
            'Only approved accounts can change account status',
          );
        }

        const validTransition =
          (status === 'inactive' && currentLifecycleStatus === 'active') ||
          (status === 'suspended' &&
            ['active', 'inactive'].includes(currentLifecycleStatus)) ||
          (status === 'active' &&
            ['inactive', 'suspended'].includes(currentLifecycleStatus));
        if (!validTransition) {
          throw new ConflictException(
            `Cannot change account status from ${currentLifecycleStatus} to ${status}`,
          );
        }

        const previousLifecycleFilter = user.accountLifecycleStatus
          ? { accountLifecycleStatus: user.accountLifecycleStatus }
          : {
              accountLifecycleStatus: { $exists: false },
              accountStatus: user.accountStatus,
            };
        const changed = await this.users
          .findOneAndUpdate(
            { _id: targetUserId, ...previousLifecycleFilter },
            { $set: { accountLifecycleStatus: status } },
            { new: true, runValidators: true, session },
          )
          .exec();
        if (!changed) {
          throw new ConflictException(
            'This account was updated by another Admin. Refresh and try again.',
          );
        }

        previousStatus = currentLifecycleStatus;
        accountType = user.accountType;
        const action =
          status === 'suspended'
            ? 'account_suspended'
            : status === 'inactive'
              ? 'account_deactivated'
              : 'account_activated';
        await this.auditLogs.create(
          [
            {
              targetUserId,
              adminUserId,
              action,
              previousApprovalStatus: approvalStatus,
              newApprovalStatus: approvalStatus,
              previousAccountStatus: previousStatus,
              newAccountStatus: status,
              ...(normalizedReason ? { reason: normalizedReason } : {}),
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (!accountType || !previousStatus || !approvalStatus) {
      throw new ConflictException('The account status update did not complete');
    }
    const notificationType =
      status === 'suspended'
        ? 'account_suspended'
        : status === 'inactive'
          ? 'account_deactivated'
          : 'account_activated';
    const label = accountType === 'shop' ? 'Shop' : 'Customer';
    const statusMessage =
      status === 'suspended'
        ? `Your ${label} account has been suspended.${normalizedReason ? ` Reason: ${normalizedReason}` : ''}`
        : status === 'inactive'
          ? `Your ${label} account has been deactivated.`
          : `Your ${label} account has been reactivated.`;
    await this.notificationsService.notifyUsers([targetUserId], {
      title:
        status === 'suspended'
          ? 'Account Suspended'
          : status === 'inactive'
            ? 'Account Deactivated'
            : 'Account Reactivated',
      message: statusMessage,
      type: notificationType,
      relatedEntityId: targetUserId,
      relatedEntityType: 'user_account',
      link: accountType === 'shop' ? '/shop/profile' : '/customer/profile',
    });
    return { accountStatus: status };
  }

  async approveRegistration(
    id: string,
    adminId: string,
  ): Promise<AdminRegistrationRequest> {
    return this.reviewRegistration(id, adminId, 'approved');
  }

  async declineRegistration(
    id: string,
    adminId: string,
    input: DeclineRegistrationDto,
  ): Promise<AdminRegistrationRequest> {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('A decline reason is required');
    }
    return this.reviewRegistration(
      id,
      adminId,
      'declined',
      reason,
      input.adminRemarks,
    );
  }

  async getPendingShops(): Promise<ShopApplication[]> {
    const users = await this.usersService.findPendingShopAccounts();
    return users.map((user) => this.toShopApplication(user));
  }

  async approveShop(id: string): Promise<ShopApplication> {
    await this.ensureLegacyShopApplication(id);
    throw new ConflictException(
      'Shop registration must be paid before approval',
    );
  }

  async rejectShop(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<ShopApplication> {
    if (!isObjectIdOrHexString(id) || !isObjectIdOrHexString(adminId)) {
      throw new NotFoundException('Pending shop application not found');
    }
    await this.ensureLegacyShopApplication(id);
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('A decline reason is required');
    }
    const session = await this.connection.startSession();
    let updatedUser: UserDocument | null = null;
    try {
      const result = await session.withTransaction(async () => {
        const declinedUser = await this.usersService.updatePendingShopStatus(
          id,
          'rejected',
          session,
        );
        if (!declinedUser) {
          throw new ConflictException(
            'This shop application is no longer pending review',
          );
        }
        await this.auditLogs.create(
          [
            {
              targetUserId: declinedUser._id,
              adminUserId: new Types.ObjectId(adminId),
              action: 'registration_declined',
              previousApprovalStatus: 'pending',
              newApprovalStatus: 'declined',
              previousAccountStatus: 'inactive',
              newAccountStatus: 'inactive',
              reason: normalizedReason,
            },
          ],
          { session },
        );
        return declinedUser;
      });
      updatedUser = result ?? null;
    } finally {
      await session.endSession();
    }
    if (!updatedUser) {
      throw new ConflictException('The shop application could not be declined');
    }
    await this.notificationsService.notifyUsers([updatedUser._id], {
      title: 'Shop Registration Declined',
      message: `Your Shop registration was declined. Reason: ${normalizedReason}`,
      type: 'registration_declined',
      relatedEntityId: updatedUser._id,
      relatedEntityType: 'user_account',
      link: '/shop/profile',
    });
    return this.toShopApplication(updatedUser);
  }

  private async reviewRegistration(
    id: string,
    adminId: string,
    decision: 'approved' | 'declined',
    declineReason?: string,
    adminRemarks?: string,
  ): Promise<AdminRegistrationRequest> {
    if (!isObjectIdOrHexString(id) || !isObjectIdOrHexString(adminId)) {
      throw new NotFoundException('Pending registration request not found');
    }

    const session = await this.connection.startSession();
    let updatedRequestId: unknown;
    let applicantId: Types.ObjectId | undefined;
    let applicantType: 'customer' | 'shop' | undefined;
    try {
      updatedRequestId = await session.withTransaction(async () => {
        const request = await this.registrationRequests
          .findOne({
            _id: id,
            registrationStatus: { $in: ['pending', 'approved', 'declined'] },
          })
          .session(session)
          .exec();
        if (!request) {
          throw new NotFoundException('Registration request not found');
        }
        if (request.userId.toString() === adminId) {
          throw new ConflictException(
            'Administrators cannot review their own registration',
          );
        }
        if (request.accountType !== 'shop') {
          throw new ConflictException(
            'Customer accounts do not require registration approval',
          );
        }
        if (request.registrationStatus !== 'pending') {
          throw new ConflictException(
            'Only pending registrations can be approved or declined',
          );
        }
        applicantId = request.userId;
        applicantType = request.accountType;
        if (
          decision === 'approved' &&
          request.accountType === 'shop' &&
          request.paymentStatus !== 'paid'
        ) {
          throw new ConflictException(
            'Shop registration must be paid before approval',
          );
        }

        const changedRequest = await this.registrationRequests
          .findOneAndUpdate(
            {
              _id: request._id,
              registrationStatus: request.registrationStatus,
            },
            {
              $set: {
                registrationStatus: decision,
                reviewedBy: adminId,
                reviewedAt: new Date(),
                ...(declineReason ? { declineReason } : {}),
                ...(adminRemarks?.trim()
                  ? { adminRemarks: adminRemarks.trim() }
                  : {}),
              },
              ...(decision === 'approved'
                ? { $unset: { declineReason: 1 } }
                : {}),
            },
            { new: true, runValidators: true, session },
          )
          .exec();
        if (!changedRequest) {
          throw new ConflictException(
            'This registration was updated by another Admin. Refresh and try again.',
          );
        }

        const accountStatus = decision === 'approved' ? 'active' : 'rejected';
        const accountUpdated =
          await this.usersService.updateRegistrationAccountStatus(
            request.userId.toString(),
            request.accountType,
            accountStatus,
            session,
          );
        if (!accountUpdated) {
          throw new ConflictException(
            'The applicant account could not be updated. Refresh and try again.',
          );
        }
        await this.auditLogs.create(
          [
            {
              targetUserId: request.userId,
              adminUserId: new Types.ObjectId(adminId),
              action:
                decision === 'approved'
                  ? 'registration_approved'
                  : 'registration_declined',
              previousApprovalStatus: request.registrationStatus,
              newApprovalStatus: decision,
              previousAccountStatus:
                request.registrationStatus === 'pending'
                  ? 'inactive'
                  : 'active',
              newAccountStatus: decision === 'approved' ? 'active' : 'inactive',
              ...(declineReason ? { reason: declineReason } : {}),
            },
          ],
          { session },
        );
        await this.notificationsService.notifyApplicantOfRegistrationDecision(
          request.userId,
          request._id,
          request.accountType,
          decision,
          declineReason,
          session,
        );
        return changedRequest._id;
      });
    } finally {
      await session.endSession();
    }

    if (!(updatedRequestId instanceof Types.ObjectId)) {
      throw new NotFoundException('Pending registration request not found');
    }

    if (applicantId && applicantType) {
      await this.notificationsService.sendRegistrationDecision(
        applicantId,
        updatedRequestId,
        applicantType,
        decision,
        declineReason,
      );
    }

    const [result] = await this.registrationRequests
      .aggregate<Record<string, unknown>>([
        { $match: { _id: updatedRequestId } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            userId: '$user._id',
            registrationNumber: 1,
            applicantName: mongoUserDisplayName(
              '$user.firstName',
              '$user.lastName',
              '$user.fullName',
            ),
            shopName: '$user.shopDetails.shopName',
            businessType: '$user.shopDetails.businessType',
            businessAddress: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$user.shopDetails.address', ''] },
                    {
                      $cond: [
                        { $eq: ['$user.shopDetails.landmark', ''] },
                        '',
                        {
                          $concat: [
                            ', ',
                            { $ifNull: ['$user.shopDetails.landmark', ''] },
                          ],
                        },
                      ],
                    },
                    {
                      $cond: [
                        { $eq: ['$user.shopDetails.city', ''] },
                        '',
                        {
                          $concat: [
                            ', ',
                            { $ifNull: ['$user.shopDetails.city', ''] },
                          ],
                        },
                      ],
                    },
                    {
                      $cond: [
                        { $eq: ['$user.shopDetails.state', ''] },
                        '',
                        {
                          $concat: [
                            ', ',
                            { $ifNull: ['$user.shopDetails.state', ''] },
                          ],
                        },
                      ],
                    },
                    {
                      $cond: [
                        { $eq: ['$user.shopDetails.postalCode', ''] },
                        '',
                        {
                          $concat: [
                            ', ',
                            { $ifNull: ['$user.shopDetails.postalCode', ''] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            services: { $ifNull: ['$user.shopDetails.services', []] },
            email: '$user.email',
            countryCode: '$user.countryCode',
            mobileNumber: '$user.mobileNumber',
            accountType: 1,
            accountStatus: {
              $cond: [
                {
                  $in: [
                    '$user.accountStatus',
                    ['active', 'inactive', 'suspended'],
                  ],
                },
                '$user.accountStatus',
                null,
              ],
            },
            registrationStatus: 1,
            paymentStatus: 1,
            subscriptionPlan: {
              $cond: [
                { $eq: ['$accountType', 'shop'] },
                'Fixroa Shop monthly subscription',
                null,
              ],
            },
            paymentAmountCents: 1,
            paymentCurrency: 1,
            paidAt: 1,
            submittedAt: 1,
            reviewedAt: { $ifNull: ['$reviewedAt', null] },
            declineReason: { $ifNull: ['$declineReason', null] },
            latitude: {
              $ifNull: [
                '$user.shopDetails.location.latitude',
                '$user.location.latitude',
              ],
            },
            longitude: {
              $ifNull: [
                '$user.shopDetails.location.longitude',
                '$user.location.longitude',
              ],
            },
          },
        },
      ])
      .exec();
    if (!result) {
      throw new NotFoundException('Registration applicant not found');
    }
    return this.toAdminRegistrationRequest(result);
  }

  private async ensureLegacyShopApplication(id: string): Promise<void> {
    const registration = await this.registrationRequests
      .findOne({ userId: id })
      .exec();
    if (registration) {
      throw new ConflictException(
        'Use the registration review action for this shop account',
      );
    }
  }

  private toAdminRegistrationRequest(
    value: Record<string, unknown>,
  ): AdminRegistrationRequest {
    const userId = this.idToString(value['userId']);
    const id = this.idToString(value['_id']);
    const registrationRequestId = this.idToString(
      value['registrationRequestId'],
    );
    const registrationStatus = value['registrationStatus'];
    return {
      id,
      userId,
      registrationRequestId: registrationRequestId || null,
      registrationNumber:
        typeof value['registrationNumber'] === 'string'
          ? value['registrationNumber']
          : '',
      applicantName:
        typeof value['applicantName'] === 'string'
          ? value['applicantName']
          : '',
      shopName:
        typeof value['shopName'] === 'string' ? value['shopName'] : null,
      businessType:
        typeof value['businessType'] === 'string'
          ? value['businessType']
          : null,
      businessAddress:
        typeof value['businessAddress'] === 'string'
          ? value['businessAddress']
          : null,
      services: Array.isArray(value['services'])
        ? value['services'].filter(
            (service): service is string => typeof service === 'string',
          )
        : [],
      email: typeof value['email'] === 'string' ? value['email'] : '',
      countryCode:
        typeof value['countryCode'] === 'string' ? value['countryCode'] : '',
      mobileNumber:
        typeof value['mobileNumber'] === 'string' ? value['mobileNumber'] : '',
      accountType: value['accountType'] === 'shop' ? 'shop' : 'customer',
      accountStatus:
        value['accountStatus'] === 'active' ||
        value['accountStatus'] === 'inactive' ||
        value['accountStatus'] === 'suspended'
          ? value['accountStatus']
          : null,
      registrationStatus:
        registrationStatus === 'approved' || registrationStatus === 'declined'
          ? registrationStatus
          : 'pending',
      paymentStatus:
        value['paymentStatus'] === 'paid' || value['paymentStatus'] === 'unpaid'
          ? value['paymentStatus']
          : 'not_required',
      subscriptionPlan:
        value['subscriptionPlan'] === 'Fixroa Shop monthly subscription' ||
        value['subscriptionPlan'] === 'Reparo Shop monthly subscription'
          ? 'Fixroa Shop monthly subscription'
          : null,
      paymentAmountCents:
        typeof value['paymentAmountCents'] === 'number'
          ? value['paymentAmountCents']
          : null,
      paymentCurrency:
        typeof value['paymentCurrency'] === 'string'
          ? value['paymentCurrency']
          : null,
      paidAt: value['paidAt'] instanceof Date ? value['paidAt'] : null,
      submittedAt: value['submittedAt'] as Date,
      reviewedAt:
        value['reviewedAt'] instanceof Date ? value['reviewedAt'] : null,
      declineReason:
        typeof value['declineReason'] === 'string'
          ? value['declineReason']
          : null,
      latitude:
        typeof value['latitude'] === 'number' ? value['latitude'] : null,
      longitude:
        typeof value['longitude'] === 'number' ? value['longitude'] : null,
      city: typeof value['city'] === 'string' ? value['city'] : '',
      state: typeof value['state'] === 'string' ? value['state'] : '',
    };
  }

  private idToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return value instanceof Types.ObjectId ? value.toString() : '';
  }

  private toShopApplication(user: {
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    countryCode?: string;
    mobileNumber?: string;
    createdAt: Date;
    shopDetails?: ShopDetails;
  }): ShopApplication {
    return {
      id: user._id.toString(),
      ownerFirstName: userNameParts(user).firstName,
      ownerLastName: userNameParts(user).lastName,
      email: user.email,
      countryCode: user.countryCode ?? '',
      mobileNumber: user.mobileNumber ?? '',
      createdAt: user.createdAt,
      shop: user.shopDetails ?? null,
    };
  }
}

function mongoUserDisplayName(
  firstName: unknown,
  lastName: unknown,
  legacyName: unknown,
  fallback = '',
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
