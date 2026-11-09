import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerRepairRequest, RepairReview } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerRepairWorkflowComponent } from './customer-repair-workflow.component';

type RepairRatingKey =
  | 'overallRating'
  | 'repairQuality'
  | 'communication'
  | 'professionalism'
  | 'timeliness'
  | 'valueForMoney';

@Component({
  selector: 'app-customer-repair-job-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomerRepairWorkflowComponent],
  templateUrl: './customer-repair-job.page.html',
  styleUrl: './customer-repair-job.page.scss',
})
export class CustomerRepairJobPage implements OnInit {
  readonly job = signal<CustomerRepairRequest | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly received = signal(true);
  readonly inspected = signal(true);
  readonly satisfaction = signal('satisfied');
  readonly comments = signal('');
  readonly issueDescription = signal('');
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
  private requestId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly portal: CustomerPortalService,
  ) {}

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.requestId) {
      this.error.set('Repair job was not found.');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.portal.getRepairJob(this.requestId).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair job could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  confirmPickup(): void {
    if (!this.received()) {
      if (!this.issueDescription().trim()) {
        this.error.set('Describe the collection issue before submitting.');
        return;
      }
      this.reportIssue();
      return;
    }
    if (!this.inspected() && !this.issueDescription().trim()) {
      this.error.set('Describe the issue found during inspection.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    this.portal
      .confirmPickup(this.requestId, {
        received: this.received(),
        inspected: this.inspected(),
        satisfaction: this.satisfaction(),
        comments: this.comments().trim() || undefined,
        issueDescription: this.issueDescription().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notice.set(
            this.inspected()
              ? 'Pickup confirmed. Please rate your repair experience.'
              : 'Your issue report has been sent to the shop and Admin.',
          );
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message || 'Pickup confirmation could not be saved.');
          this.submitting.set(false);
        },
      });
  }

  reportIssue(): void {
    if (!this.issueDescription().trim()) {
      this.error.set('Describe the issue before submitting.');
      return;
    }
    void this.router.navigate(['/customer/disputes/new', this.requestId], {
      queryParams: { description: this.issueDescription().trim() },
    });
  }

  submitReview(): void {
    if (!this.reviewText().trim()) {
      this.error.set('Please share your repair experience before submitting.');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
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
    this.portal.submitRepairReview(this.requestId, input).subscribe({
      next: () => {
        this.notice.set('Thank you. Your verified review has been submitted.');
        this.submitting.set(false);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Your review could not be submitted.');
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

  get timeline(): Array<{ action: string; label: string; at?: string }> {
    const job = this.job();
    if (!job) return [];
    const entries = [
      { action: 'submitted', label: 'Request submitted', at: job.createdAt },
      ...(job.acceptedQuotation
        ? [
            {
              action: 'confirmed',
              label: 'Quotation accepted · repair confirmed',
              at: job.repairJob?.confirmedAt,
            },
          ]
        : []),
      ...(job.repairJob?.startedAt
        ? [{ action: 'in_progress', label: 'Repair in progress', at: job.repairJob.startedAt }]
        : []),
      ...(job.repairJob?.repairCompletedAt
        ? [
            {
              action: 'repair_completed',
              label: 'Repair work completed',
              at: job.repairJob.repairCompletedAt,
            },
          ]
        : []),
      ...(job.repairJob?.readyForPickupAt
        ? [
            {
              action: 'ready_for_pickup',
              label: 'Ready for pickup',
              at: job.repairJob.readyForPickupAt,
            },
          ]
        : []),
      ...(job.repairJob?.pickedUpAt
        ? [
            {
              action: 'picked_up',
              label: 'Item collected and inspected',
              at: job.repairJob.pickedUpAt,
            },
          ]
        : []),
      ...(job.repairJob?.completedAt
        ? [
            {
              action: 'completed',
              label: 'Review submitted · job completed',
              at: job.repairJob.completedAt,
            },
          ]
        : []),
    ];
    return entries;
  }
}
