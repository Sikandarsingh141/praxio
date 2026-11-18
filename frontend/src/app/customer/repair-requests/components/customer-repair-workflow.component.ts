import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { CustomerRepairRequest, RepairReview } from '../../models/customer-portal.models';
import { CustomerPortalService } from '../../services/customer-portal.service';
import { ToastService } from '../../../core/toast/toast.service';
import { AdditionalChargeRequest } from '../../../shared/models/repair-workflow.models';

type RepairRatingKey =
  | 'overallRating'
  | 'repairQuality'
  | 'communication'
  | 'professionalism'
  | 'timeliness'
  | 'valueForMoney';

@Component({
  selector: 'app-customer-repair-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-repair-workflow.component.html',
  styleUrl: './customer-repair-workflow.component.scss',
})
export class CustomerRepairWorkflowComponent {
  @Input({ required: true }) request!: CustomerRepairRequest;
  @Input() showApprovalSummaryInFlow = true;
  @Output() readonly requestUpdated = new EventEmitter<CustomerRepairRequest>();

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly approvalDialogOpen = signal(false);
  readonly declineDialogOpen = signal(false);
  readonly decisionReason = signal('');
  readonly confirmingCharge = signal<AdditionalChargeRequest | null>(null);
  readonly chargeDecision = signal<'accept' | 'decline'>('accept');
  readonly received = signal(true);
  readonly inspected = signal(true);
  readonly satisfaction = signal('satisfied');
  readonly pickupComments = signal('');
  readonly pickupIssueDescription = signal('');

  openApprovalDialog(): void {
    this.approvalDialogOpen.set(true);
  }

  openDeclineDialog(): void {
    this.declineDialogOpen.set(true);
  }
  readonly overallRating = signal(5);
  readonly repairQuality = signal(5);
  readonly communication = signal(5);
  readonly professionalism = signal(5);
  readonly timeliness = signal(5);
  readonly valueForMoney = signal(5);
  readonly reviewTitle = signal('');
  readonly reviewText = signal('');
  readonly liked = signal('');
  readonly improvement = signal('');
  readonly wouldRecommend = signal(true);
  readonly starValues = [1, 2, 3, 4, 5];
  readonly ratingFields: Array<{ key: RepairRatingKey; label: string }> = [
    { key: 'overallRating', label: 'Overall shop rating' },
    { key: 'repairQuality', label: 'Repair quality' },
    { key: 'communication', label: 'Service and communication' },
    { key: 'professionalism', label: 'Professionalism' },
    { key: 'timeliness', label: 'Timeliness' },
    { key: 'valueForMoney', label: 'Value for money' },
  ];

  constructor(
    private readonly portal: CustomerPortalService,
    private readonly toastService: ToastService,
    private readonly router: Router,
  ) {}

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

  confirmPickup(): void {
    if (!this.received()) {
      if (!this.pickupIssueDescription().trim()) {
        this.error.set('Describe the collection issue before submitting.');
        return;
      }
      this.reportPickupIssue();
      return;
    }
    if (!this.inspected() && !this.pickupIssueDescription().trim()) {
      this.error.set('Describe the issue found during inspection.');
      return;
    }

    this.error.set('');
    this.submitting.set(true);
    let pickupConfirmed = false;
    this.portal
      .confirmPickup(this.request._id, {
        received: this.received(),
        inspected: this.inspected(),
        satisfaction: this.satisfaction(),
        comments: this.pickupComments().trim() || undefined,
        issueDescription: this.pickupIssueDescription().trim() || undefined,
      })
      .pipe(
        tap(() => {
          pickupConfirmed = true;
        }),
        switchMap(() => this.portal.getRepairJob(this.request._id)),
      )
      .subscribe({
        next: (request) => {
          this.requestUpdated.emit(request);
          this.toastService.success(
            'Pickup Status',
            this.inspected()
              ? 'Pickup confirmed. Please rate your repair experience.'
              : 'Your issue report has been sent to the shop and Admin.',
          );
          this.submitting.set(false);
        },
        error: (error: HttpErrorResponse) => {
          const fallback = pickupConfirmed
            ? 'Pickup was confirmed, but the updated repair details could not be loaded.'
            : 'Pickup confirmation could not be saved.';
          const message = error.error?.message || fallback;
          this.error.set(message);
          this.toastService.error(
            pickupConfirmed ? 'Refresh Failed' : 'Confirmation Failed',
            message,
          );
          this.submitting.set(false);
        },
      });
  }

  private reportPickupIssue(): void {
    void this.router.navigate(['/customer/disputes/new', this.request._id], {
      queryParams: { description: this.pickupIssueDescription().trim() },
    });
  }

  submitReview(): void {
    if (!this.reviewText().trim()) {
      this.error.set('Please share your repair experience before submitting.');
      return;
    }

    this.error.set('');
    this.submitting.set(true);
    const input: Omit<RepairReview, '_id' | 'repairRequestId' | 'createdAt'> = {
      overallRating: this.overallRating(),
      repairQuality: this.repairQuality(),
      communication: this.communication(),
      professionalism: this.professionalism(),
      timeliness: this.timeliness(),
      valueForMoney: this.valueForMoney(),
      title: this.reviewTitle().trim() || undefined,
      reviewText: this.reviewText().trim(),
      liked: this.liked().trim() || undefined,
      improvement: this.improvement().trim() || undefined,
      wouldRecommend: this.wouldRecommend(),
    };
    let reviewSubmitted = false;
    this.portal
      .submitRepairReview(this.request._id, input)
      .pipe(
        tap(() => {
          reviewSubmitted = true;
        }),
        switchMap(() => this.portal.getRepairJob(this.request._id)),
      )
      .subscribe({
        next: (request) => {
          this.requestUpdated.emit(request);
          this.toastService.success(
            'Review Submitted',
            'Thank you. Your verified review has been submitted.',
          );
          this.submitting.set(false);
        },
        error: (error: HttpErrorResponse) => {
          const fallback = reviewSubmitted
            ? 'Your review was submitted, but the updated repair details could not be loaded.'
            : 'Your review could not be submitted.';
          const message = error.error?.message || fallback;
          this.error.set(message);
          this.toastService.error(reviewSubmitted ? 'Refresh Failed' : 'Review Failed', message);
          this.submitting.set(false);
        },
      });
  }

  ratingValue(key: RepairRatingKey): number {
    return this[key]();
  }

  setRating(key: RepairRatingKey, value: number): void {
    this[key].set(value);
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
        this.toastService.success('Repair Workflow', message);
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
    const msg = error.error?.message || fallback;
    this.error.set(msg);
    this.toastService.error('Workflow Error', msg);
    this.submitting.set(false);
  }
}
