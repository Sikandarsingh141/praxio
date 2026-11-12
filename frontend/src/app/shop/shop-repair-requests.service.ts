import {
  AdditionalChargeRequest,
  AdditionalChargeRequestInput,
  InspectionReportInput,
} from '../shared/repair-workflow.models';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from '../core/auth/auth.models';
import { SKIP_GLOBAL_LOADER } from '../core/loading/global-loader.context';
import {
  ShopQuotation,
  ShopQuotationInput,
  ShopRepairRequest,
  ShopRepairRequestPage,
  ShopRequestFilters,
  ShopQuotationFilters,
  ShopQuotationPage,
  ShopDashboardOverview,
  ShopReviewSummary,
  ShopRepairRoute,
} from './shop-repair-requests.models';

@Injectable({ providedIn: 'root' })
export class ShopRepairRequestsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/shop/repair-requests`;
  private readonly quotationsUrl = `${environment.apiBaseUrl}/shop/quotations`;

  constructor(private readonly http: HttpClient) {}

  listQuotations(filters: ShopQuotationFilters): Observable<ShopQuotationPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<ShopQuotationPage>>(this.quotationsUrl, { params })
      .pipe(map((response) => response.data));
  }

  list(
    filters: ShopRequestFilters,
    options: { silent?: boolean } = {},
  ): Observable<ShopRepairRequestPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<ShopRepairRequestPage>>(this.baseUrl, {
        params,
        context: new HttpContext().set(SKIP_GLOBAL_LOADER, options.silent ?? false),
      })
      .pipe(map((response) => response.data));
  }

  get(id: string): Observable<ShopRepairRequest> {
    return this.http
      .get<ApiEnvelope<{ request: ShopRepairRequest }>>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(map((response) => response.data.request));
  }

  getDirections(id: string): Observable<ShopRepairRoute> {
    return this.http
      .get<ApiEnvelope<{ route: ShopRepairRoute }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/directions`,
      )
      .pipe(map((response) => response.data.route));
  }

  getReviews(): Observable<ShopReviewSummary> {
    return this.http
      .get<ApiEnvelope<ShopReviewSummary>>(`${this.quotationsUrl}/reviews`)
      .pipe(map((response) => response.data));
  }

  getDashboardOverview(
    filters: { from?: string; to?: string } = {},
    options: { silent?: boolean } = {},
  ): Observable<ShopDashboardOverview> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http
      .get<ApiEnvelope<ShopDashboardOverview>>(
        `${environment.apiBaseUrl}/shop/dashboard/overview`,
        {
          params,
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, options.silent ?? false),
        },
      )
      .pipe(map((response) => response.data));
  }

  submitQuotation(id: string, input: ShopQuotationInput): Observable<ShopQuotation> {
    return this.http
      .post<ApiEnvelope<{ quotation: ShopQuotation }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/quotation`,
        input,
      )
      .pipe(map((response) => response.data.quotation));
  }

  decline(id: string, reason: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<{ declined: true }>>(`${this.baseUrl}/${encodeURIComponent(id)}/decline`, {
        reason,
      })
      .pipe(map(() => undefined));
  }

  startInspection(id: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.baseUrl}/${encodeURIComponent(id)}/start-inspection`, {})
      .pipe(map(() => undefined));
  }

  saveInspection(id: string, input: InspectionReportInput): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/inspection-report`,
        input,
      )
      .pipe(map(() => undefined));
  }

  startApprovedRepair(id: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.baseUrl}/${encodeURIComponent(id)}/start-repair`, {})
      .pipe(map(() => undefined));
  }

  requestAdditionalCharges(
    id: string,
    input: AdditionalChargeRequestInput,
  ): Observable<AdditionalChargeRequest> {
    return this.http
      .post<ApiEnvelope<{ chargeRequest: AdditionalChargeRequest }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/additional-charges`,
        input,
      )
      .pipe(map((response) => response.data.chargeRequest));
  }

  startRepair(id: string, notes?: string): Observable<void> {
    return this.updateRepair(id, 'start-repair', { notes });
  }

  holdRepair(id: string, notes?: string): Observable<void> {
    return this.updateRepair(id, 'hold-repair', { notes });
  }

  completeRepair(
    id: string,
    input: {
      completionDescription: string;
      workPerformed: string;
      partsReplaced?: string;
      finalNotes?: string;
    },
  ): Observable<void> {
    return this.updateRepair(id, 'complete-repair', input);
  }

  readyForPickup(
    id: string,
    input: { pickupInstructions: string; message?: string },
  ): Observable<void> {
    return this.updateRepair(id, 'ready-for-pickup', input);
  }

  private updateRepair(id: string, action: string, input: object): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ repairJob: unknown }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/${action}`,
        input,
      )
      .pipe(map(() => undefined));
  }
}
