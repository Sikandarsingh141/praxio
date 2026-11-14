import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from '../core/auth/auth.models';
import { SKIP_GLOBAL_LOADER } from '../core/loading/global-loader.context';

export interface ShopApplication {
  id: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  createdAt: string;
  shop: {
    shopName: string;
    businessType: string;
    description: string;
    yearsOfExperience: number;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    landmark: string;
    services: string[];
  } | null;
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
  paidAt: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  declineReason: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  state?: string;
}

export interface RegistrationRequestPage {
  requests: AdminRegistrationRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
    createdAt: string;
    link: string;
    amountCents?: number;
    currency?: string;
    status?: string;
  }>;
  recentRegistrations: Array<{
    id: string;
    name: string;
    accountType: 'customer' | 'shop';
    createdAt: string;
  }>;
  recentRepairs: Array<{
    id: string;
    customerId: string;
    customerName: string;
    appliance: string;
    description: string;
    createdAt: string;
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

export interface AdminUserActivity {
  id: string;
  adminUserId: string;
  action: string;
  previousApprovalStatus: string;
  newApprovalStatus: string;
  previousAccountStatus: string;
  newAccountStatus: string;
  reason: string | null;
  createdAt: string;
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
  createdAt: string;
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
    submittedAt: string;
    reviewedAt: string | null;
    declineReason: string | null;
    adminRemarks: string | null;
    paymentStatus: string;
    paymentAmountCents: number | null;
    paymentCurrency: string | null;
    paidAt: string | null;
  } | null;
  repairActivity: Array<{
    id: string;
    appliance: string;
    description: string;
    status: string;
    repairStatus: string | null;
    createdAt: string;
    preferredServiceDate: string | null;
  }>;
  quotationActivity: Array<{
    id: string;
    repairRequestId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    validUntil: string | null;
  }>;
}

export interface AdminRepairJob {
  _id: string;
  appliance: string;
  description: string;
  brand?: string;
  model?: string;
  serviceType?: 'shop_visit' | 'home_service';
  preferredServiceDate?: string;
  photos?: Array<{ mimeType: string; data: string }>;
  createdAt: string;
  updatedAt: string;
  repairJob: {
    status: string;
    confirmedAt?: string;
    startedAt?: string;
    repairCompletedAt?: string;
    readyForPickupAt?: string;
    pickedUpAt?: string;
    completedAt?: string;
    approvedRepairAmount?: number;
    completionDescription?: string;
    workPerformed?: string;
    partsReplaced?: string;
    finalNotes?: string;
    pickupInstructions?: string;
    pickupMessage?: string;
    disputeDescription?: string;
    disputeResolution?: string;
    inspection?: {
      status?: string;
      identifiedProblem?: string;
      findings?: string;
      requiredRepairWork?: string;
      parts?: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
      partsTotal?: number;
      labourCharge?: number;
      inspectionCharges?: number;
      otherCharges?: number;
      estimatedTotal?: number;
      estimatedTimeValue?: number;
      estimatedTimeUnit?: string;
      warranty?: string;
      images?: Array<{ mimeType: string; data: string }>;
      message?: string;
      decisionReason?: string;
      submittedAt?: string;
      decidedAt?: string;
    };
    history?: Array<{ action: string; notes?: string; at: string }>;
  };
  customer: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    countryCode?: string;
    mobileNumber?: string;
  };
  shopName?: string;
  shop?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    countryCode?: string;
    mobileNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  quotation?: {
    id?: string;
    amount: number;
    currency: string;
    status: string;
    message?: string;
    inspectionCharge?: number;
    partsCost?: number;
    labourCharge?: number;
    additionalCharges?: number;
    proposedSolution?: string;
    warrantyInformation?: string;
    additionalNotes?: string;
    estimatedDays?: number;
    validUntil?: string;
    createdAt?: string;
  };
}

export interface AdminRepairReview {
  _id: string;
  overallRating: number;
  repairQuality: number;
  communication: number;
  professionalism: number;
  timeliness: number;
  valueForMoney: number;
  title?: string;
  reviewText: string;
  liked?: string;
  improvement?: string;
  wouldRecommend: boolean;
  verifiedAt: string;
  createdAt: string;
  customerName?: string;
  shopName?: string;
  appliance?: string;
}

export interface AdminMonitorPage<T> {
  page: number;
  limit: number;
  total: number;
  jobs?: T[];
  reviews?: T[];
}

export type AdminMapType = 'all' | 'customers' | 'shops' | 'requests';

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
  createdAt?: string;
  quotationAmount?: number | null;
  quotationCurrency?: string | null;
  repairCounts?: { total: number; active: number; completed: number };
  profileImageUrl?: string | null;
  shopImageUrl?: string | null;
  services?: string[];
  rating?: number | null;
  reviewCount?: number;
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
  page: number;
  limit: number;
  total: number;
}

export interface AdminMapMarker {
  id: string;
  type: 'customer' | 'shop' | 'request';
  name: string;
  status: string;
  location: { latitude: number; longitude: number };
}

export interface AdminMapRoute {
  distanceMeters: number;
  durationSeconds: number;
  description: string;
  path: Array<{ latitude: number; longitude: number }>;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  getMapData(
    options: {
      type: AdminMapType;
      page: number;
      limit: number;
      search?: string;
      city?: string;
      state?: string;
      from?: string;
      to?: string;
      status?: string;
      approvalStatus?: string;
    },
    requestOptions: { silent?: boolean } = {},
  ): Observable<AdminMapData> {
    let params = new HttpParams()
      .set('type', options.type)
      .set('page', options.page)
      .set('limit', options.limit);
    for (const key of [
      'search',
      'city',
      'state',
      'from',
      'to',
      'status',
      'approvalStatus',
    ] as const) {
      const value = options[key]?.trim();
      if (value) params = params.set(key, value);
    }
    return this.http
      .get<ApiEnvelope<AdminMapData>>(`${environment.apiBaseUrl}/admin/map`, {
        params,
        context: new HttpContext().set(SKIP_GLOBAL_LOADER, requestOptions.silent ?? false),
      })
      .pipe(map((response) => response.data));
  }

  getMapMarkers(
    options: {
      type?: AdminMapType;
      search?: string;
      city?: string;
      state?: string;
      from?: string;
      to?: string;
      status?: string;
      approvalStatus?: string;
    },
    requestOptions: { silent?: boolean } = {},
  ): Observable<AdminMapMarker[]> {
    let params = new HttpParams().set('type', options.type ?? 'requests');
    for (const key of [
      'search',
      'city',
      'state',
      'from',
      'to',
      'status',
      'approvalStatus',
    ] as const) {
      const value = options[key]?.trim();
      if (value) params = params.set(key, value);
    }
    return this.http
      .get<ApiEnvelope<{ markers: AdminMapMarker[] }>>(
        `${environment.apiBaseUrl}/admin/map/markers`,
        {
          params,
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, requestOptions.silent ?? false),
        },
      )
      .pipe(map((response) => response.data.markers));
  }

  getMapRequest(requestId: string): Observable<AdminMapEntity> {
    return this.http
      .get<ApiEnvelope<AdminMapEntity>>(
        `${environment.apiBaseUrl}/admin/map/repair-requests/${encodeURIComponent(requestId)}`,
      )
      .pipe(map((response) => response.data));
  }

  getMapUser(userId: string, type: 'customer' | 'shop'): Observable<AdminMapEntity | null> {
    return this.getMapData({
      type: type === 'customer' ? 'customers' : 'shops',
      page: 1,
      limit: 10,
      search: userId,
    }).pipe(
      map(
        (data) =>
          data.entities.find((entity) => entity.id === userId && entity.type === type) ?? null,
      ),
    );
  }

  getMapRoute(requestId: string): Observable<AdminMapRoute> {
    return this.http
      .get<ApiEnvelope<{ route: AdminMapRoute }>>(
        `${environment.apiBaseUrl}/admin/map/repair-requests/${encodeURIComponent(requestId)}/route`,
      )
      .pipe(map((response) => response.data.route));
  }

  getMapLocationLabel(latitude: number, longitude: number): Observable<string> {
    const params = new HttpParams()
      .set('latitude', String(latitude))
      .set('longitude', String(longitude));
    return this.http
      .get<ApiEnvelope<{ label: string }>>(`${environment.apiBaseUrl}/admin/map/reverse-geocode`, {
        params,
      })
      .pipe(map((response) => response.data.label));
  }

  getDashboardOverview(
    from: string,
    to: string,
    options: { silent?: boolean } = {},
  ): Observable<AdminDashboardOverview> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiEnvelope<AdminDashboardOverview>>(
        `${environment.apiBaseUrl}/admin/dashboard/overview`,
        {
          params,
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, options.silent ?? false),
        },
      )
      .pipe(map((response) => response.data));
  }

  getRepairJobs(
    status: string,
    page: number,
    limit: number,
    requestId?: string,
    search?: string,
    from?: string,
    to?: string,
    requestOptions: { silent?: boolean } = {},
  ): Observable<AdminMonitorPage<AdminRepairJob>> {
    let params = new HttpParams().set('status', status).set('page', page).set('limit', limit);
    if (requestId) {
      params = params.set('requestId', requestId);
    }
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http
      .get<ApiEnvelope<AdminMonitorPage<AdminRepairJob>>>(
        `${environment.apiBaseUrl}/admin/repair-jobs`,
        {
          params,
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, requestOptions.silent ?? false),
        },
      )
      .pipe(map((response) => response.data));
  }

  getRepairJobDetails(id: string): Observable<AdminRepairJob | null> {
    return this.getRepairJobs('all', 1, 1, id).pipe(map((page) => page.jobs?.[0] ?? null));
  }

  getRepairReviews(page: number, limit: number): Observable<AdminMonitorPage<AdminRepairReview>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiEnvelope<AdminMonitorPage<AdminRepairReview>>>(
        `${environment.apiBaseUrl}/admin/repair-reviews`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  getRegistrationRequests(options: {
    page: number;
    limit: number;
    status: string;
    accountType?: string;
    accountStatus?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: string;
    silent?: boolean;
  }): Observable<RegistrationRequestPage> {
    let params = new HttpParams()
      .set('page', options.page)
      .set('limit', options.limit)
      .set('status', options.status);
    if (options.accountType) {
      params = params.set('accountType', options.accountType);
    }
    if (options.accountStatus && options.accountStatus !== 'all') {
      params = params.set('accountStatus', options.accountStatus);
    }
    if (options.search?.trim()) {
      params = params.set('search', options.search.trim());
    }
    if (options.fromDate) {
      params = params.set('fromDate', options.fromDate);
    }
    if (options.toDate) {
      params = params.set('toDate', options.toDate);
    }
    if (options.sortBy) {
      params = params.set('sortBy', options.sortBy);
    }
    if (options.sortOrder) {
      params = params.set('sortOrder', options.sortOrder);
    }
    return this.http
      .get<ApiEnvelope<RegistrationRequestPage>>(`${environment.apiBaseUrl}/admin/users`, {
        params,
        context: new HttpContext().set(SKIP_GLOBAL_LOADER, options.silent ?? false),
      })
      .pipe(map((response) => response.data));
  }

  getUserStatistics(): Observable<AdminUserStatistics> {
    return this.http
      .get<ApiEnvelope<AdminUserStatistics>>(`${environment.apiBaseUrl}/admin/users/statistics`)
      .pipe(map((response) => response.data));
  }

  updateUserStatus(
    id: string,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string,
  ): Observable<{ accountStatus: 'active' | 'inactive' | 'suspended' }> {
    return this.http
      .patch<ApiEnvelope<{ accountStatus: 'active' | 'inactive' | 'suspended' }>>(
        `${environment.apiBaseUrl}/admin/users/${encodeURIComponent(id)}/status`,
        { status, ...(reason ? { reason } : {}) },
      )
      .pipe(map((response) => response.data));
  }

  getUserActivity(id: string): Observable<AdminUserActivity[]> {
    return this.http
      .get<ApiEnvelope<AdminUserActivity[]>>(
        `${environment.apiBaseUrl}/admin/users/${encodeURIComponent(id)}/activity`,
      )
      .pipe(map((response) => response.data));
  }

  getUserDetails(id: string): Observable<AdminUserDetails> {
    return this.http
      .get<ApiEnvelope<AdminUserDetails>>(
        `${environment.apiBaseUrl}/admin/users/${encodeURIComponent(id)}`,
      )
      .pipe(map((response) => response.data));
  }

  approveRegistration(id: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ request: AdminRegistrationRequest }>>(
        `${environment.apiBaseUrl}/admin/registration-requests/${encodeURIComponent(id)}/approve`,
        {},
      )
      .pipe(map(() => undefined));
  }

  declineRegistration(id: string, reason: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ request: AdminRegistrationRequest }>>(
        `${environment.apiBaseUrl}/admin/registration-requests/${encodeURIComponent(id)}/decline`,
        { reason },
      )
      .pipe(map(() => undefined));
  }

  approveExistingShop(userId: string): Observable<void> {
    return this.updateShop(userId, 'approve').pipe(map(() => undefined));
  }

  declineExistingShop(userId: string, reason: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ shop: ShopApplication }>>(
        `${environment.apiBaseUrl}/admin/shops/${encodeURIComponent(userId)}/reject`,
        { reason },
      )
      .pipe(map(() => undefined));
  }

  getPendingShops(): Observable<ShopApplication[]> {
    return this.http
      .get<ApiEnvelope<{ shops: ShopApplication[] }>>(
        `${environment.apiBaseUrl}/admin/shops/pending`,
      )
      .pipe(map((response) => response.data.shops));
  }

  approveShop(id: string): Observable<ShopApplication> {
    return this.updateShop(id, 'approve');
  }

  rejectShop(id: string): Observable<ShopApplication> {
    return this.updateShop(id, 'reject');
  }

  private updateShop(id: string, action: 'approve' | 'reject'): Observable<ShopApplication> {
    return this.http
      .patch<ApiEnvelope<{ shop: ShopApplication }>>(
        `${environment.apiBaseUrl}/admin/shops/${encodeURIComponent(id)}/${action}`,
        {},
      )
      .pipe(map((response) => response.data.shop));
  }
}
