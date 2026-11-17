import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { JobAttachmentsComponent } from '../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../shared/components/job-timeline/job-timeline.component';
import { TechnicianRepairDetails } from '../../../shop/technicians/technicians.models';
import { JobSharedService } from '../../../shared/services/job-shared.service';
import { JobStatusBadgeComponent } from '../../../shared/components/job-status-badge/job-status-badge.component';
import { ShopRepairRouteComponent } from '../../../shop/repair-job-details/components/shop-repair-route.component';

@Component({
  selector: 'app-technician-repair-detail-sections',
  standalone: true,
  imports: [
    CommonModule,
    JobAttachmentsComponent,
    JobTimelineComponent,
    JobStatusBadgeComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './technician-repair-detail-sections.component.html',
  styleUrl: './technician-repair-detail-sections.component.scss',
})
export class TechnicianRepairDetailSectionsComponent {
  @Input({ required: true }) job!: TechnicianRepairDetails;
  readonly jobs = inject(JobSharedService);
  readonly directionsLoader = (requestId: string) =>
    this.jobs.technicianDirections(requestId);
}
