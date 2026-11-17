import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { ShopRepairWorkflowComponent } from '../../../repair-job-details/components/shop-repair-workflow.component';

@Component({
  selector: 'app-shop-active-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent, ShopRepairWorkflowComponent],
  templateUrl: './shop-active-job-detail.page.html',
  styleUrl: './shop-active-job-detail.page.scss',
})
export class ShopActiveJobDetailPage extends ShopJobDetailPageBase {
  readonly backRoute = '/shop/jobs/active-jobs';
  readonly backLabel = 'Active Repairs';
  readonly pageTitle = 'Active Repair Details';
  legacyDetailRoute(id: string): string[] { return ['/shop/repair-requests', id]; }
}

