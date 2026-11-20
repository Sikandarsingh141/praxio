import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../../../shared/components/repair-progress/repair-progress.component';
import { ShopRepairPickupComponent } from '../../../repair-job-details/components/shop-repair-pickup.component';
import { ShopRepairWorkflowComponent } from '../../../repair-job-details/components/shop-repair-workflow.component';

@Component({
  selector: 'app-shop-pending-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobStatusBadgeComponent,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
    ShopRepairPickupComponent,
    ShopRepairWorkflowComponent,
  ],
  templateUrl: './shop-pending-job-detail.page.html',
  styleUrl: './shop-pending-job-detail.page.scss',
})
export class ShopPendingJobDetailPage extends ShopJobDetailPageBase {
  readonly backRoute = '/shop/jobs/pending-jobs';
  readonly backLabel = 'Pending Requests';
  readonly pageTitle = 'Pending Request Details';
  legacyDetailRoute(id: string): string[] { return ['/shop/repair-requests', id]; }

  onRequestUpdated(request: ShopRepairRequest): void {
    this.refreshRecord(request);
  }

  onInspectionStarted(requestId: string): void {
    void this.router.navigate(['/shop/jobs/active-jobs', requestId]);
  }
}

