import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from '../core/auth/auth.models';
import {
  DisputeAttachment,
  DisputeListFilters,
  DisputeListResult,
  DisputePriority,
  DisputeRole,
  DisputeStatus,
  RepairDispute,
} from './disputes.models';

@Injectable({ providedIn: 'root' })
export class DisputesService {
  private readonly baseUrl = `${environment.apiBaseUrl}`;

  constructor(private readonly http: HttpClient) {}

  list(role: DisputeRole, filters: DisputeListFilters = {}): Observable<DisputeListResult> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<DisputeListResult>>(`${this.baseUrl}/${role}/disputes`, { params })
      .pipe(map((response) => response.data));
  }

  get(role: DisputeRole, id: string): Observable<RepairDispute> {
    return this.http
      .get<ApiEnvelope<RepairDispute>>(`${this.baseUrl}/${role}/disputes/${encodeURIComponent(id)}`)
      .pipe(map((response) => response.data));
  }

  create(
    repairRequestId: string,
    input: {
      category: string;
      description: string;
      attachments: DisputeAttachment[];
      customerComments?: string;
    },
  ): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/customer/disputes/repair/${encodeURIComponent(repairRequestId)}`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  sendMessage(
    role: DisputeRole,
    id: string,
    input: { message: string; attachments?: DisputeAttachment[] },
  ): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/${role}/disputes/${encodeURIComponent(id)}/messages`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  accept(id: string): Observable<RepairDispute> {
    return this.patchShop(id, 'accept');
  }

  reject(
    id: string,
    input: {
      reason: string;
      explanation: string;
      attachments?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/reject`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  respondAsShop(
    id: string,
    input: {
      message: string;
      explanation: string;
      proposedResolution?: string;
      attachments?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/response`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  startReinspection(id: string): Observable<RepairDispute> {
    return this.patchShop(id, 'reinspection/start');
  }

  submitReinspection(
    id: string,
    input: {
      findings: string;
      requiredRepairWork: string;
      estimatedCompletionTime?: string;
      attachments?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.postShop(id, 'reinspection', input);
  }

  requestAdditionalCharges(
    id: string,
    input: {
      reason: string;
      items: Array<{ description: string; amount: number }>;
      message?: string;
    },
  ): Observable<RepairDispute> {
    return this.postShop(id, 'additional-charges', input);
  }

  decideAdditionalCharges(
    id: string,
    chargeId: string,
    decision: 'accept' | 'decline',
    reason?: string,
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/customer/disputes/${encodeURIComponent(id)}/additional-charges/${encodeURIComponent(chargeId)}/decision`,
        { decision, reason },
      )
      .pipe(map((response) => response.data));
  }

  startRework(id: string): Observable<RepairDispute> {
    return this.patchShop(id, 'start-rework');
  }

  addProgress(
    id: string,
    input: { notes: string; attachments?: DisputeAttachment[] },
  ): Observable<RepairDispute> {
    return this.postShop(id, 'progress', input);
  }

  completeRework(
    id: string,
    input: {
      workPerformed: string;
      partsReplaced?: string;
      testingResults: string;
      finalNotes?: string;
      tested: boolean;
      attachments?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/complete-rework`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  confirmResolution(
    id: string,
    input: { message: string; attachments?: DisputeAttachment[] },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/customer/disputes/${encodeURIComponent(id)}/confirm-resolution`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  reportUnresolved(
    id: string,
    input: { notes: string; attachments?: DisputeAttachment[] },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/customer/disputes/${encodeURIComponent(id)}/report-unresolved`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  close(id: string, reason: string): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/close`,
        { reason },
      )
      .pipe(map((response) => response.data));
  }

  addInternalNote(id: string, message: string): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/admin/disputes/${encodeURIComponent(id)}/internal-notes`,
        { message },
      )
      .pipe(map((response) => response.data));
  }

  updateAdminStatus(
    id: string,
    input: { status: DisputeStatus; reason: string; priority?: DisputePriority },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/admin/disputes/${encodeURIComponent(id)}/status`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  proposeResolution(
    role: DisputeRole,
    id: string,
    input: {
      type: string;
      description: string;
      amount?: number;
      responsibleParty: string;
      notes: string;
      documents?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/${role}/disputes/${encodeURIComponent(id)}/resolution`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  decideResolution(
    role: DisputeRole,
    id: string,
    input: { decision: 'accept' | 'reject'; reason?: string },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/${role}/disputes/${encodeURIComponent(id)}/resolution/decision`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  resolveDispute(
    role: DisputeRole,
    id: string,
    input: {
      completionNotes: string;
      refundTransactionId?: string;
      requiredActionCompleted?: boolean;
      documents?: DisputeAttachment[];
    },
  ): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/${role}/disputes/${encodeURIComponent(id)}/resolve`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  closeAsAdmin(id: string, reason: string): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/admin/disputes/${encodeURIComponent(id)}/close`,
        { reason },
      )
      .pipe(map((response) => response.data));
  }

  private patchShop(id: string, action: string): Observable<RepairDispute> {
    return this.http
      .patch<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/${action}`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  private postShop(id: string, action: string, input: unknown): Observable<RepairDispute> {
    return this.http
      .post<ApiEnvelope<RepairDispute>>(
        `${this.baseUrl}/shop/disputes/${encodeURIComponent(id)}/${action}`,
        input,
      )
      .pipe(map((response) => response.data));
  }
}
