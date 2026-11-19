import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../../../shared/components/repair-progress/repair-progress.component';

@Component({
  selector: 'app-shop-assigned-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobStatusBadgeComponent,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
  ],
  templateUrl: './shop-assigned-job-detail.page.html',
  styleUrl: './shop-assigned-job-detail.page.scss',
})
export class ShopAssignedJobDetailPage extends ShopJobDetailPageBase {
  readonly backRoute = '/shop/jobs/assigned-jobs';
  readonly backLabel = 'Assigned Requests';
  readonly pageTitle = 'Assigned Request Details';
  legacyDetailRoute(id: string): string[] { return ['/shop/repair-requests', id]; }
}

