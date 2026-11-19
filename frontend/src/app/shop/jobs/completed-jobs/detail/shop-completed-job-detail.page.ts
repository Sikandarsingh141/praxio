import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../../../shared/components/repair-progress/repair-progress.component';
import { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';

@Component({
  selector: 'app-shop-completed-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
  ],
  templateUrl: './shop-completed-job-detail.page.html',
  styleUrl: './shop-completed-job-detail.page.scss',
})
export class ShopCompletedJobDetailPage extends ShopJobDetailPageBase {
  readonly heroImageUnavailable = signal(false);
  readonly backRoute = '/shop/jobs/completed-jobs';
  readonly backLabel = 'Completed Repairs';
  readonly pageTitle = 'Completed Repair Details';
  readonly customerMapUrl = computed(() => {
    const job = this.record();
    if (!job) return null;
    const location = job.customer.location ??
      (typeof job.customerLatitude === 'number' && typeof job.customerLongitude === 'number'
        ? { latitude: job.customerLatitude, longitude: job.customerLongitude }
        : null);
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

  customerName(job: ShopRepairRequest): string {
    return (
      job.customer.displayName?.trim() ||
      [job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') ||
      'Customer'
    );
  }

  customerInitials(job: ShopRepairRequest): string {
    return this.customerName(job)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  photoSource(photo: ShopRepairRequest['photos'][number]): string {
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

  statusLabel(job: ShopRepairRequest): string {
    const status = job.repairJob?.status ?? job.shopResponse.status;
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

}

