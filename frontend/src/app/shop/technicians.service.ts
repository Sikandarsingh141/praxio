import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiEnvelope } from '../core/auth/auth.models';
import { environment } from '../../environments/environment';
import {
  Technician,
  TechnicianAssignment,
  TechnicianInput,
  TechnicianJob,
  TechnicianJobSummary,
  TechnicianListResponse,
  TechnicianRepairDetails,
} from './technicians.models';

@Injectable({ providedIn: 'root' })
export class TechniciansService {
  private readonly baseUrl = `${environment.apiBaseUrl}/shop/technicians`;

  constructor(private readonly http: HttpClient) {}

  list(filters: { search?: string; status?: string; skill?: string } = {}): Observable<TechnicianListResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return this.http
      .get<ApiEnvelope<TechnicianListResponse>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  get(id: string): Observable<Technician> {
    return this.http
      .get<ApiEnvelope<{ technician: Technician }>>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(map((response) => response.data.technician));
  }

  create(input: TechnicianInput): Observable<Technician> {
    return this.http
      .post<ApiEnvelope<{ technician: Technician }>>(this.baseUrl, input)
      .pipe(map((response) => response.data.technician));
  }

  update(id: string, input: Partial<TechnicianInput>): Observable<Technician> {
    return this.http
      .patch<ApiEnvelope<{ technician: Technician }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}`,
        input,
      )
      .pipe(map((response) => response.data.technician));
  }

  updateStatus(
    id: string,
    status: 'active' | 'inactive',
    availabilityPreference?: 'available' | 'on_leave',
  ): Observable<Technician> {
    return this.http
      .patch<ApiEnvelope<{ technician: Technician }>>(
        `${this.baseUrl}/${encodeURIComponent(id)}/status`,
        { status, availabilityPreference },
      )
      .pipe(map((response) => response.data.technician));
  }

  assignments(): Observable<TechnicianAssignment[]> {
    return this.http
      .get<ApiEnvelope<{ assignments: TechnicianAssignment[] }>>(
        `${this.baseUrl}/assignments`,
      )
      .pipe(map((response) => response.data.assignments));
  }

  assign(
    requestId: string,
    input: { technicianId?: string; note?: string; reason?: string },
  ): Observable<{ warning: string | null }> {
    return this.http
      .post<ApiEnvelope<{ warning: string | null }>>(
        `${environment.apiBaseUrl}/shop/repair-requests/${encodeURIComponent(requestId)}/assignment`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  unassign(requestId: string, reason: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<{ unassigned: true }>>(
        `${environment.apiBaseUrl}/shop/repair-requests/${encodeURIComponent(requestId)}/assignment`,
        { body: { reason } },
      )
      .pipe(map(() => undefined));
  }

  myJobs(
    filter: string = 'all',
  ): Observable<{ jobs: TechnicianJob[]; summary: TechnicianJobSummary }> {
    const params = new HttpParams().set('filter', filter);
    return this.http
      .get<ApiEnvelope<{ jobs: TechnicianJob[]; summary: TechnicianJobSummary }>>(
        `${environment.apiBaseUrl}/technician/jobs`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  myProfile(): Observable<Technician> {
    return this.http
      .get<ApiEnvelope<{ technician: Technician }>>(`${environment.apiBaseUrl}/technician/me`)
      .pipe(map((response) => response.data.technician));
  }

  updateMyAvailability(
    availabilityPreference: 'available' | 'on_leave',
  ): Observable<Technician> {
    return this.http
      .patch<ApiEnvelope<{ technician: Technician }>>(
        `${environment.apiBaseUrl}/technician/me/availability`,
        { availabilityPreference },
      )
      .pipe(map((response) => response.data.technician));
  }

  myJobDetails(id: string): Observable<TechnicianRepairDetails> {
    return this.http
      .get<ApiEnvelope<{ request: TechnicianRepairDetails }>>(
        `${environment.apiBaseUrl}/technician/jobs/${encodeURIComponent(id)}`,
      )
      .pipe(map((response) => response.data.request));
  }

  startJob(id: string, notes: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<unknown>>(
        `${environment.apiBaseUrl}/technician/jobs/${encodeURIComponent(id)}/start`,
        { notes },
      )
      .pipe(map(() => undefined));
  }

  holdJob(id: string, notes: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<unknown>>(
        `${environment.apiBaseUrl}/technician/jobs/${encodeURIComponent(id)}/hold`,
        { notes },
      )
      .pipe(map(() => undefined));
  }

  completeJob(
    id: string,
    input: { completionDescription: string; workPerformed: string; partsReplaced?: string; finalNotes?: string },
  ): Observable<void> {
    return this.http
      .patch<ApiEnvelope<unknown>>(
        `${environment.apiBaseUrl}/technician/jobs/${encodeURIComponent(id)}/complete`,
        input,
      )
      .pipe(map(() => undefined));
  }
}
