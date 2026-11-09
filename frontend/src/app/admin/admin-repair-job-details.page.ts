import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminRepairJob, AdminService } from './admin.service';

type RepairDetailsTab = 'overview' | 'history' | 'documents' | 'notes';

@Component({
  selector: 'app-admin-repair-job-details-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, TitleCasePipe],
  templateUrl: './admin-repair-job-details.page.html',
  styleUrl: './admin-repair-job-details.page.scss',
})
export class AdminRepairJobDetailsPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  readonly job = signal<AdminRepairJob | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly activeTab = signal<RepairDetailsTab>('overview');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Repair job could not be found.');
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  shopLocation(job: AdminRepairJob): string {
    return [
      job.shop?.address,
      job.shop?.city,
      job.shop?.state,
      job.shop?.postalCode,
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ');
  }

  documentCount(job: AdminRepairJob): number {
    return (job.photos?.length ?? 0) + (job.repairJob.inspection?.images?.length ?? 0);
  }

  documents(job: AdminRepairJob): Array<{ mimeType: string; data: string; label: string }> {
    return [
      ...(job.photos ?? []).map((document, index) => ({
        ...document,
        label: `Repair request photo ${index + 1}`,
      })),
      ...(job.repairJob.inspection?.images ?? []).map((document, index) => ({
        ...document,
        label: `Inspection photo ${index + 1}`,
      })),
    ];
  }

  notes(job: AdminRepairJob): Array<{ label: string; text: string; at?: string }> {
    const notes: Array<{ label: string; text: string; at?: string }> = [];
    [job.quotation?.additionalNotes]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) =>
      notes.push({ label: 'Accepted quotation', text, at: job.quotation?.createdAt }),
      );
    const inspection = job.repairJob.inspection;
    [inspection?.message, inspection?.decisionReason]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) =>
        notes.push({ label: 'Inspection', text, at: inspection?.submittedAt }),
      );
    [job.repairJob.finalNotes, job.repairJob.pickupMessage]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) => notes.push({ label: 'Repair update', text }));
    return notes;
  }

  timeline(job: AdminRepairJob): Array<{ label: string; at?: string; state: 'done' | 'current' | 'upcoming' }> {
    const currentIndex = this.currentTimelineIndex(job);
    const dates = [
      job.createdAt,
      job.quotation?.createdAt ?? job.repairJob.confirmedAt,
      job.repairJob.startedAt,
      job.repairJob.repairCompletedAt ?? job.repairJob.readyForPickupAt,
      job.repairJob.completedAt,
    ];
    return ['Request submitted', 'Quotation accepted', 'Repair in progress', 'Under review', 'Completed']
      .map((label, index) => ({
        label,
        at: dates[index],
        state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
      }));
  }

  setTab(tab: RepairDetailsTab): void {
    this.activeTab.set(tab);
  }

  private currentTimelineIndex(job: AdminRepairJob): number {
    const status = job.repairJob.status;
    if (status === 'completed') return 4;
    if (
      status === 'disputed' ||
      status === 'repair_completed' ||
      status === 'ready_for_pickup' ||
      status === 'picked_up'
    ) {
      return 3;
    }
    if (
      status === 'in_progress' ||
      status === 'on_hold' ||
      status === 'inspection_pending' ||
      status === 'inspection_in_progress' ||
      status === 'awaiting_customer_approval' ||
      status === 'inspection_approved' ||
      status === 'repair_declined'
    ) {
      return 2;
    }
    return 1;
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.adminService.getRepairJobDetails(id).subscribe({
      next: (job) => {
        this.job.set(job);
        if (!job) this.error.set('Repair job could not be found.');
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair job details could not be loaded.');
        this.loading.set(false);
      },
    });
  }
}
