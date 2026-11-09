import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerRepairRequest } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { AdditionalChargeRequest } from '../shared/repair-workflow.models';

@Component({
  selector: 'app-customer-repair-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-repair-workflow.component.html',
  styleUrl: './customer-repair-workflow.component.scss',
})
export class CustomerRepairWorkflowComponent {
  @Input({ required: true }) request!: CustomerRepairRequest;
  @Output() readonly requestUpdated = new EventEmitter<CustomerRepairRequest>();

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly approvalDialogOpen = signal(false);
  readonly declineDialogOpen = signal(false);
  readonly decisionReason = signal('');
  readonly confirmingCharge = signal<AdditionalChargeRequest | null>(null);
  readonly chargeDecision = signal<'accept' | 'decline'>('accept');

  constructor(private readonly portal: CustomerPortalService) {}

  get job() {
    return this.request.repairJob;
  }

  get inspection() {
    return this.job?.inspection;
  }

  get approvedTotal(): number {
    return (this.job?.approvedRepairAmount ?? 0) + (this.job?.approvedAdditionalCharges ?? 0);
  }

  get pendingCharges(): AdditionalChargeRequest[] {
    return (this.job?.additionalChargeRequests ?? []).filter(
      (charge) => charge.status === 'pending',
    );
  }

  get pendingTotal(): number {
    return this.pendingCharges.reduce((total, charge) => total + charge.amount, 0);
  }

  get rejectedTotal(): number {
    return (this.job?.additionalChargeRequests ?? [])
      .filter((charge) => charge.status === 'rejected')
      .reduce((total, charge) => total + charge.amount, 0);
  }

  get hasReviewedAdditionalCharges(): boolean {
    return (this.job?.additionalChargeRequests ?? []).some((charge) => charge.status !== 'draft');
  }

  approveInspection(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.portal.decideRepairInspection(this.request._id, 'approve').subscribe({
      next: () =>
        this.reloadRequest('Repair estimate approved. The shop can now start the repair.'),
      error: (error: HttpErrorResponse) => this.fail(error, 'The estimate could not be approved.'),
    });
  }

  declineInspection(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.portal
      .decideRepairInspection(
        this.request._id,
        'decline',
        this.decisionReason().trim() || undefined,
      )
      .subscribe({
        next: () => this.reloadRequest('You declined the inspection estimate.'),
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'The estimate could not be declined.'),
      });
  }

  openChargeDecision(charge: AdditionalChargeRequest, decision: 'accept' | 'decline'): void {
    this.decisionReason.set('');
    this.chargeDecision.set(decision);
    this.confirmingCharge.set(charge);
  }

  submitChargeDecision(): void {
    const charge = this.confirmingCharge();
    if (!charge || this.submitting()) return;
    const decision = this.chargeDecision();
    this.submitting.set(true);
    this.error.set('');
    this.portal
      .decideAdditionalCharge(
        this.request._id,
        charge._id,
        decision,
        this.decisionReason().trim() || undefined,
      )
      .subscribe({
        next: () =>
          this.reloadRequest(
            decision === 'accept'
              ? 'Additional repair work approved.'
              : 'Additional repair work declined.',
          ),
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Your additional-charge decision could not be saved.'),
      });
  }

  private reloadRequest(message: string): void {
    this.portal.getRepairJob(this.request._id).subscribe({
      next: (request) => {
        this.requestUpdated.emit(request);
        this.notice.set(message);
        this.submitting.set(false);
        this.approvalDialogOpen.set(false);
        this.declineDialogOpen.set(false);
        this.confirmingCharge.set(null);
        this.decisionReason.set('');
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'Your updated repair details could not be loaded.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.error.set(error.error?.message || fallback);
    this.submitting.set(false);
  }
}
