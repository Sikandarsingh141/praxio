import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ChatService } from '../shared/chat.service';
import {
  Technician,
  TechnicianJob,
  TechnicianJobSummary,
  TechnicianRepairDetails,
} from './technicians.models';
import { TechniciansService } from './technicians.service';

type JobFilter = 'all' | 'today' | 'in_progress' | 'completed' | 'on_hold';
type TechnicianView = 'dashboard' | 'jobs' | 'history';

const EMPTY_SUMMARY: TechnicianJobSummary = {
  assigned: 0,
  inProgress: 0,
  completed: 0,
  onHold: 0,
  today: 0,
};

@Component({
  selector: 'app-shop-technician-portal-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './shop-technician-portal.page.html',
  styleUrl: './shop-technician-portal.page.scss',
})
export class ShopTechnicianPortalPage implements OnInit {
  readonly technician = signal<Technician | null>(null);
  readonly jobs = signal<TechnicianJob[]>([]);
  readonly summary = signal<TechnicianJobSummary>(EMPTY_SUMMARY);
  readonly selectedJobId = signal('');
  readonly details = signal<TechnicianRepairDetails | null>(null);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly updating = signal(false);
  readonly messaging = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly filter = signal<JobFilter>('all');
  readonly searchText = signal('');
  readonly notes = signal('');
  readonly completionOpen = signal(false);
  readonly completionDescription = signal('');
  readonly workPerformed = signal('');
  readonly partsReplaced = signal('');
  readonly view = signal<TechnicianView>('dashboard');
  readonly visibleJobs = computed(() => {
    const query = this.searchText().trim().toLocaleLowerCase();
    const matches = this.jobs().filter((job) =>
      !query ||
      [job.id, job.appliance, job.brand, job.model, job.customer]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
    return this.view() === 'dashboard' ? matches.slice(0, 5) : matches;
  });
  readonly filterOptions: Array<{ key: JobFilter; label: string }> = [
    { key: 'all', label: 'My Assigned Jobs' },
    { key: 'today', label: "Today's Jobs" },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On Hold' },
  ];

  constructor(
    private readonly service: TechniciansService,
    private readonly chat: ChatService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const view = this.route.snapshot.data['technicianView'];
    if (view === 'jobs' || view === 'history') this.view.set(view);
    this.service.myProfile().subscribe({
      next: (profile) => this.technician.set(profile),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Technician profile could not be loaded.'),
    });
    this.loadJobs(this.view() === 'history' ? 'history' : 'all');
  }

  counts(): Record<JobFilter, number> {
    const summary = this.summary();
    return {
      all: summary.assigned,
      today: summary.today,
      in_progress: summary.inProgress,
      completed: summary.completed,
      on_hold: summary.onHold,
    };
  }

  setFilter(filter: JobFilter): void {
    this.filter.set(filter);
    this.loadJobs(filter);
  }

  openJob(job: TechnicianJob): void {
    this.selectedJobId.set(job.id);
    this.detailLoading.set(true);
    this.details.set(null);
    this.error.set('');
    this.service.myJobDetails(job.id).subscribe({
      next: (details) => {
        this.details.set(details);
        this.detailLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair details could not be loaded.');
        this.detailLoading.set(false);
      },
    });
  }

  messageCustomer(): void {
    const repair = this.details();
    if (!repair || this.messaging()) return;
    this.messaging.set(true);
    this.chat.createConversation(repair.id, repair.shopId).subscribe({
      next: (conversation) =>
        void this.router.navigate(['/technician/messages'], {
          queryParams: { conversationId: conversation.id },
        }),
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'A message conversation could not be opened.');
        this.messaging.set(false);
      },
      complete: () => this.messaging.set(false),
    });
  }

  startJob(): void {
    const details = this.details();
    if (!details) return;
    this.runAction(this.service.startJob(details.id, this.notes()));
  }

  holdJob(): void {
    const details = this.details();
    if (!details) return;
    this.runAction(this.service.holdJob(details.id, this.notes()));
  }

  completeJob(): void {
    const details = this.details();
    if (!details || !this.completionDescription().trim() || !this.workPerformed().trim()) {
      this.error.set('Enter a completion summary and describe the work performed.');
      return;
    }
    this.runAction(
      this.service.completeJob(details.id, {
        completionDescription: this.completionDescription().trim(),
        workPerformed: this.workPerformed().trim(),
        partsReplaced: this.partsReplaced().trim() || undefined,
      }),
    );
  }

  private loadJobs(filter: JobFilter | 'history'): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .myJobs(filter)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.jobs.set(result.jobs);
          this.summary.set(result.summary);
          const selected =
            result.jobs.find((job) => job.id === this.selectedJobId()) ?? result.jobs[0];
          if (selected) {
            this.openJob(selected);
          } else {
            this.selectedJobId.set('');
            this.details.set(null);
          }
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message || 'Assigned jobs could not be loaded.'),
      });
  }

  private runAction(request: ReturnType<TechniciansService['startJob']>): void {
    this.updating.set(true);
    this.error.set('');
    this.success.set('');
    request.pipe(finalize(() => this.updating.set(false))).subscribe({
      next: () => {
        this.success.set('Repair progress updated.');
        this.completionOpen.set(false);
        this.loadJobs(this.view() === 'history' ? 'history' : this.filter());
      },
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Repair progress could not be updated.'),
    });
  }
}
