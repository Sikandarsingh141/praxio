import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile } from '../../core/auth/auth.models';
import { JobAttachmentsComponent } from '../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../shared/components/job-timeline/job-timeline.component';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { CustomerRepairRequest } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { CustomerRepairWorkflowComponent } from '../repair-requests/components/customer-repair-workflow.component';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-customer-repair-job-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    CustomerRepairWorkflowComponent,
  ],
  templateUrl: './customer-repair-job.page.html',
  styleUrl: './customer-repair-job.page.scss',
})
export class CustomerRepairJobPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly jobs = inject(JobSharedService);
  readonly job = signal<CustomerRepairRequest | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly heroImageUnavailable = signal(false);
  readonly customerAvatarUnavailable = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly issueDescription = signal('');
  readonly progressSteps = [
    'Request Submitted',
    'Inspection Pending',
    'Quotation',
    'Repair & Complete',
  ];
  private requestId = '';
  private readonly sanitizer = inject(DomSanitizer);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly portal: CustomerPortalService,
    private readonly toastService: ToastService,
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
        this.heroImageUnavailable.set(false);
        this.customerAvatarUnavailable.set(false);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair job could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  refreshRecord(updated: CustomerRepairRequest): void {
    this.job.set(updated);
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

  shopInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  pageTitle(repair: CustomerRepairRequest): string {
    if (repair.repairJob) return 'Repair Job Details';
    return repair.status === 'open' ? 'New Repair Request Detail' : 'Repair Request Details';
  }

  statusLabel(repair: CustomerRepairRequest): string {
    const status = repair.repairJob?.status ?? repair.status;
    if (!repair.repairJob && status === 'open') return 'New';
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  photoSource(photo: NonNullable<CustomerRepairRequest['photos']>[number]): string {
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

  customerName(user: UserProfile): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer';
  }

  customerInitials(user: UserProfile): string {
    const name = this.customerName(user);
    return name === 'Customer' ? user.email.slice(0, 1).toUpperCase() || 'C' :
      name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  customerPhone(user: UserProfile): string {
    return [user.countryCode, user.mobileNumber].filter(Boolean).join(' ') || 'Not provided';
  }

  customerLocation(user: UserProfile): string {
    return user.location
      ? `${user.location.latitude.toFixed(5)}, ${user.location.longitude.toFixed(5)}`
      : 'Not provided';
  }

  customerMapUrl(location: NonNullable<UserProfile['location']>): string {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }

  shopMapEmbedUrl(address: string): SafeResourceUrl {
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get currentProgressStep(): number {
    const repair = this.job();
    if (!repair) return 1;
    const status = repair.repairJob?.status;
    if (
      status === 'awaiting_customer_approval' ||
      status === 'repair_declined'
    ) {
      return 3;
    }
    if (status === 'inspection_approved') return 4;
    if (
      status === 'in_progress' ||
      status === 'on_hold' ||
      status === 'repair_completed' ||
      status === 'ready_for_pickup' ||
      status === 'picked_up' ||
      status === 'completed' ||
      status === 'disputed'
    ) {
      return 4;
    }
    if (repair.repairJob) return 2;
    return repair.quotations.length ? 3 : 2;
  }

  get isRepairComplete(): boolean {
    return this.job()?.repairJob?.status === 'completed';
  }

  progressDate(index: number): string | undefined {
    const repair = this.job();
    const repairJob = repair?.repairJob;
    const historyAt = (action: string): string | undefined =>
      repairJob?.history?.find((event) => event.action === action)?.at;

    switch (index) {
      case 0:
        return repair?.createdAt;
      case 1:
        return historyAt('inspection_pending') ?? repairJob?.confirmedAt;
      case 2:
        return (
          repair?.acceptedQuotation?.respondedAt ??
          repair?.acceptedQuotation?.createdAt ??
          repair?.quotations[repair.quotations.length - 1]?.createdAt
        );
      case 3:
        return (
          historyAt('repair_completed') ??
          repairJob?.repairCompletedAt ??
          historyAt('ready_for_pickup') ??
          repairJob?.readyForPickupAt ??
          repairJob?.completedAt
        );
      default:
        return undefined;
    }
  }

  shopDirectionsUrl(address: string): string | null {
    const destination = address.trim();
    if (!destination) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
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
              label: 'Quotation accepted',
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
