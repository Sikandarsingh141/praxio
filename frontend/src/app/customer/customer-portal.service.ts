import { AdditionalChargeRequest, InspectionReportInput } from '../shared/repair-workflow.models';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from '../core/auth/auth.models';
import {
  AddressSuggestion,
  CustomerRepairRequest,
  CustomerRepairRequestFilters,
  CustomerQuotation,
  RepairReview,
  QuotationListFilters,
  QuotationListResult,
  RepairQuotation,
  ShopSearchResult,
} from './customer-portal.models';

export interface ShopSearchOptions {
  query?: string;
  service?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  sort?: 'nearest' | 'relevant' | 'rating';
}

@Injectable({ providedIn: 'root' })
export class CustomerPortalService {
  private readonly baseUrl = `${environment.apiBaseUrl}/customer`;

  constructor(private readonly http: HttpClient) {}

  searchShops(options: ShopSearchOptions): Observable<ShopSearchResult[]> {
    let params = new HttpParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<{ shops: ShopSearchResult[] }>>(`${this.baseUrl}/shops`, { params })
      .pipe(map((response) => response.data.shops));
  }

  getShop(id: string): Observable<ShopSearchResult> {
    return this.http
      .get<ApiEnvelope<{ shop: ShopSearchResult }>>(
        `${this.baseUrl}/shops/${encodeURIComponent(id)}`,
      )
      .pipe(map((response) => response.data.shop));
  }

  suggestAddresses(query: string): Observable<AddressSuggestion[]> {
    const params = new HttpParams().set('q', query);
    return this.http
      .get<ApiEnvelope<{ suggestions: AddressSuggestion[] }>>(`${this.baseUrl}/addresses`, {
        params,
      })
      .pipe(map((response) => response.data.suggestions));
  }

  createRepairRequest(input: {
    shopIds: string[];
    appliance: string;
    description: string;
    photos: File[];
    brand?: string;
    model?: string;
    preferredServiceDate?: string;
    serviceType?: 'shop_visit' | 'home_service';
    customerLatitude?: number;
    customerLongitude?: number;
  }): Observable<string> {
    const formData = new FormData();
    formData.set('shopIds', JSON.stringify(input.shopIds));
    formData.set('appliance', input.appliance);
    formData.set('description', input.description);
    if (input.brand) formData.set('brand', input.brand);
    if (input.model) formData.set('model', input.model);
    if (input.preferredServiceDate) {
      formData.set('preferredServiceDate', input.preferredServiceDate);
    }
    if (input.serviceType) formData.set('serviceType', input.serviceType);
    if (input.customerLatitude !== undefined) {
      formData.set('customerLatitude', String(input.customerLatitude));
    }
    if (input.customerLongitude !== undefined) {
      formData.set('customerLongitude', String(input.customerLongitude));
    }
    input.photos.forEach((photo) => formData.append('photos', photo));
    return this.http
      .post<ApiEnvelope<{ request: { _id: string } }>>(`${this.baseUrl}/repair-requests`, formData)
      .pipe(map((response) => response.data.request._id));
  }

  updateRepairRequest(
    id: string,
    input: {
      shopIds: string[];
      appliance: string;
      description: string;
      brand?: string;
      model?: string;
      preferredServiceDate?: string;
      serviceType?: 'shop_visit' | 'home_service';
      photos: File[];
      removeExistingPhotos: boolean;
    },
  ): Observable<void> {
    const formData = new FormData();
    formData.set('shopIds', JSON.stringify(input.shopIds));
    formData.set('appliance', input.appliance);
    formData.set('description', input.description);
    if (input.brand) formData.set('brand', input.brand);
    if (input.model) formData.set('model', input.model);
    if (input.preferredServiceDate) {
      formData.set('preferredServiceDate', input.preferredServiceDate);
    }
    formData.set('serviceType', input.serviceType ?? 'shop_visit');
    formData.set('removeExistingPhotos', String(input.removeExistingPhotos));
    input.photos.forEach((photo) => formData.append('photos', photo));
    return this.http
      .patch<ApiEnvelope<{ request: unknown }>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}`,
        formData,
      )
      .pipe(map(() => undefined));
  }

  getRepairRequests(
    filters: CustomerRepairRequestFilters = {},
  ): Observable<CustomerRepairRequest[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<{ requests: CustomerRepairRequest[] }>>(`${this.baseUrl}/repair-requests`, {
        params,
      })
      .pipe(map((response) => response.data.requests));
  }

  getQuotations(filters: QuotationListFilters): Observable<QuotationListResult<CustomerQuotation>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<QuotationListResult<CustomerQuotation>>>(`${this.baseUrl}/quotations`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  updateQuotationStatus(
    id: string,
    status: 'accepted' | 'declined',
    rejectionReason?: string,
  ): Observable<RepairQuotation> {
    return this.http
      .patch<ApiEnvelope<{ quotation: RepairQuotation }>>(
        `${this.baseUrl}/quotations/${encodeURIComponent(id)}/status`,
        { status, rejectionReason },
      )
      .pipe(map((response) => response.data.quotation));
  }

  getRepairJob(id: string): Observable<CustomerRepairRequest> {
    return this.http
      .get<ApiEnvelope<{ repairJob: CustomerRepairRequest }>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}`,
      )
      .pipe(map((response) => response.data.repairJob));
  }

  decideRepairInspection(
    id: string,
    decision: 'approve' | 'decline',
    reason?: string,
  ): Observable<void> {
    return this.http
      .patch<ApiEnvelope<unknown>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}/inspection/${decision}`,
        { reason },
      )
      .pipe(map(() => undefined));
  }

  decideAdditionalCharge(
    requestId: string,
    chargeId: string,
    decision: 'accept' | 'decline',
    reason?: string,
  ): Observable<AdditionalChargeRequest> {
    return this.http
      .patch<ApiEnvelope<{ chargeRequest: AdditionalChargeRequest }>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(requestId)}/additional-charges/${encodeURIComponent(chargeId)}/${decision}`,
        { reason },
      )
      .pipe(map((response) => response.data.chargeRequest));
  }

  confirmPickup(
    id: string,
    input: {
      received: boolean;
      inspected: boolean;
      satisfaction?: string;
      comments?: string;
      issueDescription?: string;
    },
  ): Observable<void> {
    return this.http
      .patch<ApiEnvelope<unknown>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}/confirm-pickup`,
        input,
      )
      .pipe(map(() => undefined));
  }

  reportRepairIssue(id: string, description: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}/report-issue`,
        { description },
      )
      .pipe(map(() => undefined));
  }

  submitRepairReview(
    id: string,
    input: Omit<RepairReview, '_id' | 'repairRequestId' | 'createdAt'>,
  ): Observable<RepairReview> {
    return this.http
      .post<ApiEnvelope<{ review: RepairReview }>>(
        `${this.baseUrl}/repair-requests/${encodeURIComponent(id)}/reviews`,
        input,
      )
      .pipe(map((response) => response.data.review));
  }
}
