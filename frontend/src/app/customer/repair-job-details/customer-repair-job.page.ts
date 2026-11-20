import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { JobAttachmentsComponent } from '../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../shared/components/repair-progress/repair-progress.component';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { CustomerRepairRequest, ShopSearchResult } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { CustomerRepairWorkflowComponent } from '../repair-requests/components/customer-repair-workflow.component';
import { CustomerRepairShopProfileComponent } from '../jobs/components/customer-repair-shop-profile.component';
import { ToastService } from '../../core/toast/toast.service';

interface CustomerShopSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  address?: string;
}

@Component({
  selector: 'app-customer-repair-job-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
    CustomerRepairWorkflowComponent,
    CustomerRepairShopProfileComponent,
  ],
  templateUrl: './customer-repair-job.page.html',
  styleUrl: './customer-repair-job.page.scss',
})
export class CustomerRepairJobPage implements OnInit {
  readonly jobs = inject(JobSharedService);
  readonly job = signal<CustomerRepairRequest | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly heroImageUnavailable = signal(false);
  readonly shopProfile = signal<ShopSearchResult | null>(null);
  readonly shopProfileLoading = signal(false);
  readonly shopProfileError = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly issueDescription = signal('');
  readonly repairProgressSteps = computed(() => {
    const request = this.job();
    return request ? this.jobs.customerProgress(request) : [];
  });
  private requestId = '';
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private requestedShopId: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly portal: CustomerPortalService,
    private readonly toastService: ToastService,
  ) {
    effect(() => {
      const request = this.job();
      const shopId = request ? this.shopDetails(request)?.id ?? null : null;
      if (shopId === this.requestedShopId) return;

      this.requestedShopId = shopId;
      this.shopProfile.set(null);
      this.shopProfileError.set('');
      this.shopProfileLoading.set(!!shopId);
      if (!shopId) return;

      this.portal
        .getShop(shopId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (shop) => {
            if (this.requestedShopId !== shopId) return;
            this.shopProfile.set(shop);
            this.shopProfileLoading.set(false);
          },
          error: () => {
            if (this.requestedShopId !== shopId) return;
            this.shopProfileError.set('Shop profile information could not be loaded.');
            this.shopProfileLoading.set(false);
          },
        });
    });
  }

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

  shopDetails(job: CustomerRepairRequest): CustomerShopSummary | null {
    if (job.shop) {
      return {
        id: job.shop.id,
        name: job.shop.name,
        logoUrl: job.shop.logoUrl,
        address: job.shop.address,
      };
    }

    const acceptedQuotation =
      job.acceptedQuotation ?? job.quotations.find((quotation) => quotation.status === 'accepted');
    const shop =
      job.shops?.find((item) => item.id === acceptedQuotation?.shopId) ??
      job.shops?.find((item) => item.responseStatus === 'customer_accepted') ??
      job.shops?.find((item) => item.responseStatus === 'quotation_submitted') ??
      job.shops?.[0];
    return shop
      ? { id: shop.id, name: shop.name, logoUrl: shop.logoUrl }
      : acceptedQuotation
        ? { id: acceptedQuotation.shopId, name: 'Repair Shop' }
        : null;
  }

  shopMapEmbedUrl(address: string): SafeResourceUrl {
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
