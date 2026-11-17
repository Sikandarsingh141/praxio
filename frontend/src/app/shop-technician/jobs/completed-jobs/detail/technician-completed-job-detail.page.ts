import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TechnicianJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { ShopRepairRouteComponent } from '../../../../shop/repair-job-details/components/shop-repair-route.component';
import { TechnicianRepairDetails } from '../../../../shop/technicians/technicians.models';

@Component({
  selector: 'app-technician-completed-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './technician-completed-job-detail.page.html',
  styleUrl: './technician-completed-job-detail.page.scss',
})
export class TechnicianCompletedJobDetailPage extends TechnicianJobDetailPageBase {
  readonly heroImageUnavailable = signal(false);
  readonly progressSteps = [
    'Request Submitted',
    'Inspection Pending',
    'Quotation',
    'Repair & Complete',
  ];
  readonly backRoute = '/technician/completed-jobs';
  readonly backLabel = 'Completed Repairs';
  readonly pageTitle = 'Completed Repair Details';
  readonly customerMapUrl = computed(() => {
    const job = this.record();
    const location = job?.customerInfo?.location ?? job?.location;
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

  customerName(job: TechnicianRepairDetails): string {
    return job.customerInfo?.name?.trim() || job.customer?.trim() || 'Customer';
  }

  customerInitials(job: TechnicianRepairDetails): string {
    return this.customerName(job)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
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

  statusLabel(job: TechnicianRepairDetails): string {
    return (job.repairJobDetails?.status ?? job.status)
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  progressDate(job: TechnicianRepairDetails, index: number): string | undefined {
    if (index === 0) return job.createdAt;
    if (index === this.progressSteps.length - 1) {
      return job.repairJobDetails?.completedAt ?? job.repairJobDetails?.repairCompletedAt;
    }
    return undefined;
  }
}

