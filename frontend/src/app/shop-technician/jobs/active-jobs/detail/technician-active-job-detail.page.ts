import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TechnicianJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { TechnicianRepairDetailSectionsComponent } from '../../components/technician-repair-detail-sections.component';

@Component({
  selector: 'app-technician-active-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, TechnicianRepairDetailSectionsComponent],
  templateUrl: './technician-active-job-detail.page.html',
  styleUrl: './technician-active-job-detail.page.scss',
})
export class TechnicianActiveJobDetailPage extends TechnicianJobDetailPageBase {
  readonly backRoute = '/technician/active-jobs';
  readonly backLabel = 'Active Repairs';
  readonly pageTitle = 'Active Repair Details';
  legacyDetailRoute(id: string): string[] { return ['/technician/jobs', id]; }
}

