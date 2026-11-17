import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { TechnicianJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { ShopRepairRouteComponent } from '../../../../shop/repair-job-details/components/shop-repair-route.component';
import { TechnicianRepairDetails } from '../../../../shop/technicians/technicians.models';
import { TechniciansService } from '../../../../shop/technicians/technicians.service';
import { TechnicianAdditionalChargesComponent } from '../../components/technician-additional-charges.component';
import { ToastService } from '../../../../core/toast/toast.service';

@Component({
  selector: 'app-technician-active-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    ShopRepairRouteComponent,
    TechnicianAdditionalChargesComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './technician-active-job-detail.page.html',
  styleUrl: './technician-active-job-detail.page.scss',
})
export class TechnicianActiveJobDetailPage extends TechnicianJobDetailPageBase {
  private readonly technicians = inject(TechniciansService);
  private readonly toast = inject(ToastService);
  readonly heroImageUnavailable = signal(false);
  readonly repairActionPending = signal(false);
  readonly repairActionError = signal('');
  readonly inspectionActionPending = signal(false);
  readonly inspectionActionError = signal('');
  readonly repairConfirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly progressNotes = signal('');
  readonly completionDescription = signal('');
  readonly workPerformed = signal('');
  readonly partsReplaced = signal('');
  readonly finalNotes = signal('');
  readonly progressSteps = [
    'Request Submitted',
    'Inspection Pending',
    'Quotation',
    'Repair & Complete',
  ];
  readonly backRoute = '/technician/active-jobs';
  readonly backLabel = 'Active Repairs';
  readonly pageTitle = 'Active Repair Details';
  readonly customerMapUrl = computed(() => {
    const request = this.record();
    const location = request?.customerInfo?.location ?? request?.location;
    if (
      !location ||
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      return null;
    }
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  });

  customerName(request: TechnicianRepairDetails): string {
    return request.customerInfo?.name?.trim() || request.customer || 'Customer';
  }

  customerInitials(request: TechnicianRepairDetails): string {
    return this.customerName(request)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  shopAddress(request: TechnicianRepairDetails): string {
    return [request.shop?.address, request.shop?.city].filter(Boolean).join(', ');
  }

  photoSource(photo: TechnicianRepairDetails['photos'][number]): string {
    const data = photo.data.trim();
    if (
      data.startsWith('data:') ||
      /^https?:\/\//i.test(data) ||
      data.startsWith('/') ||
      data.startsWith('blob:')
    ) {
      return data;
    }
    return `data:${photo.mimeType || 'image/jpeg'};base64,${data}`;
  }

  statusLabel(request: TechnicianRepairDetails): string {
    return (request.repairJobDetails?.status ?? request.shopResponse?.status ?? request.status)
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  isRepairComplete(request: TechnicianRepairDetails): boolean {
    return (
      request.repairJobDetails?.status === 'completed' ||
      request.requestStatus === 'completed'
    );
  }

  currentProgressStep(request: TechnicianRepairDetails): number {
    const status = request.repairJobDetails?.status;
    if (
      status === 'in_progress' ||
      status === 'on_hold' ||
      status === 'repair_completed' ||
      status === 'ready_for_pickup' ||
      status === 'picked_up' ||
      status === 'completed' ||
      status === 'inspection_approved' ||
      request.shopResponse?.status === 'customer_accepted'
    ) {
      return 4;
    }
    if (
      status === 'awaiting_customer_approval' ||
      status === 'repair_declined' ||
      request.shopResponse?.status === 'quotation_submitted' ||
      request.quotations.length > 0
    ) {
      return 3;
    }
    return 2;
  }

  progressDate(request: TechnicianRepairDetails, index: number): string | undefined {
    const repair = request.repairJobDetails;
    switch (index) {
      case 0:
        return request.createdAt;
      case 1:
        return (
          request.timeline?.find((event) => event.action === 'inspection_pending')?.at ??
          repair?.confirmedAt
        );
      case 2:
        return (
          request.quotations.find((quotation) => quotation.status === 'accepted')?.respondedAt ??
          request.quotations[0]?.createdAt
        );
      case 3:
        return (
          request.timeline?.find((event) => event.action === 'repair_completed')?.at ??
          repair?.repairCompletedAt ??
          repair?.readyForPickupAt ??
          repair?.completedAt
        );
      default:
        return undefined;
    }
  }

  startInspection(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (
      !repair ||
      !['confirmed', 'inspection_pending'].includes(repair.status) ||
      this.inspectionActionPending()
    ) {
      return;
    }
    this.inspectionActionPending.set(true);
    this.inspectionActionError.set('');
    this.technicians
      .startInspection(this.id)
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.inspectionActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Inspection started.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Inspection could not be started.';
          this.inspectionActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  confirmStartRepair(): void {
    const request = this.record();
    const repair = request?.repairJobDetails ?? request?.repairJob;
    if (!request || repair?.status !== 'inspection_approved' || this.repairActionPending()) {
      return;
    }
    this.repairConfirmation.set({
      title: 'Start repair?',
      message: `Start this repair using the customer-approved estimate of ${(repair.approvedRepairAmount ?? request.quotation?.amount ?? 0).toFixed(2)}?`,
      confirmLabel: 'Start repair',
      cancelLabel: 'Cancel',
    });
  }

  cancelStartRepair(): void {
    this.repairConfirmation.set(null);
  }

  startApprovedRepair(): void {
    this.repairConfirmation.set(null);
    if (this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .startApprovedRepair(this.id)
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair started.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be started.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  holdRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (repair?.status !== 'in_progress' || this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .holdJob(this.id, this.progressNotes().trim())
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.progressNotes.set('');
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair placed on hold.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be placed on hold.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  resumeRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (repair?.status !== 'on_hold' || this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .startJob(this.id, this.progressNotes().trim())
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.progressNotes.set('');
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair resumed.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be resumed.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  completeRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    const completionDescription = this.completionDescription().trim();
    const workPerformed = this.workPerformed().trim();
    if (repair?.status !== 'in_progress' || this.repairActionPending()) return;
    if (!completionDescription || !workPerformed) {
      this.repairActionError.set('Provide a completion summary and work performed.');
      return;
    }
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .completeJob(this.id, {
        completionDescription,
        workPerformed,
        partsReplaced: this.partsReplaced().trim() || undefined,
        finalNotes: this.finalNotes().trim() || undefined,
      })
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.completionDescription.set('');
          this.workPerformed.set('');
          this.partsReplaced.set('');
          this.finalNotes.set('');
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair marked complete.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be completed.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }
}
