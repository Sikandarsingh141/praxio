import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../core/toast/toast.service';
import { ChatService } from '../../shared/services/chat.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import {
  InspectionReportInput,
  RepairEstimatePartInput,
  RepairInspectionReport,
  Technician,
  TechnicianDashboardData,
  TechnicianJob,
  TechnicianJobSummary,
  TechnicianRepairDetails,
} from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';

export type JobFilter = 'all' | 'pending' | 'active' | 'completed' | 'today';
export type TechnicianPageView = 'dashboard' | 'jobs' | 'active' | 'completed' | 'history' | 'job-detail';

const EMPTY_SUMMARY: TechnicianJobSummary = {
  assigned: 0,
  pending: 0,
  active: 0,
  inProgress: 0,
  completed: 0,
  onHold: 0,
  today: 0,
};


@Component({
  selector: 'app-shop-technician-portal-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ConfirmationDialogComponent,
    AdminPageHeaderComponent,
  ],
  templateUrl: './shop-technician-portal.page.html',
  styleUrl: './shop-technician-portal.page.scss',
})
export class ShopTechnicianPortalPage implements OnInit, OnDestroy {
  private readonly service = inject(TechniciansService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private focusFirstJobOnLoad = false;

  readonly view = signal<TechnicianPageView>('dashboard');
  readonly technician = signal<Technician | null>(null);
  readonly dashboard = signal<TechnicianDashboardData | null>(null);
  readonly jobs = signal<TechnicianJob[]>([]);
  readonly summary = signal<TechnicianJobSummary>(EMPTY_SUMMARY);
  readonly selectedJobId = signal<string>('');
  readonly details = signal<TechnicianRepairDetails | null>(null);

  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly updating = signal(false);
  readonly messaging = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly filter = signal<JobFilter>('all');
  readonly searchText = signal('');
  readonly sortBy = signal<'assigned' | 'scheduled' | 'appliance'>('assigned');
  readonly detailTab = signal<'details' | 'inspection' | 'timeline' | 'photos' | 'notes'>('details');

  // Modals & Confirmation Dialogs
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  private pendingAction?: (reason?: string) => void;
  readonly progressModalOpen = signal(false);
  readonly progressNote = signal('');
  readonly completionModalOpen = signal(false);
  readonly completionDescription = signal('');
  readonly workPerformed = signal('');
  readonly partsReplaced = signal('');
  readonly finalNotes = signal('');
  readonly lightboxImage = signal<string | null>(null);

  // Inspection & Checking Form State
  readonly inspectionModalOpen = signal(false);
  readonly inspectionTargetId = signal('');
  readonly inspectionTargetName = signal('');
  readonly identifiedProblem = signal('');
  readonly findings = signal('');
  readonly requiredRepairWork = signal('');
  readonly inspectionParts = signal<RepairEstimatePartInput[]>([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);
  readonly inspectionLabour = signal(0);
  readonly inspectionCharge = signal(0);
  readonly inspectionOtherCharges = signal(0);
  readonly inspectionTime = signal<number | null>(null);
  readonly inspectionTimeUnit = signal<'hours' | 'days'>('days');
  readonly inspectionWarranty = signal('');
  readonly inspectionMessage = signal('');
  readonly inspectionImages = signal<File[]>([]);
  readonly inspectionImagePreviews = signal<Array<{ name: string; url: string }>>([]);
  readonly inspectionImagesError = signal('');
  readonly submittingInspection = signal(false);

  readonly inspectionPartsTotal = computed(() => this.partsTotal(this.inspectionParts()));
  readonly inspectionTotal = computed(
    () =>
      this.inspectionPartsTotal() +
      (Math.max(0, +this.inspectionLabour() || 0)) +
      (Math.max(0, +this.inspectionCharge() || 0)) +
      (Math.max(0, +this.inspectionOtherCharges() || 0)),
  );

  readonly filterOptions: Array<{ key: JobFilter; label: string }> = [
    { key: 'all', label: 'All Jobs' },
    { key: 'pending', label: 'Pending' },
    { key: 'active', label: 'Active Jobs' },
    { key: 'completed', label: 'Completed' },
    { key: 'today', label: "Today's Schedule" },
  ];

  readonly counts = computed(() => {
    const sum = this.summary();
    const kpis = this.dashboard()?.kpis;
    return {
      all: sum.assigned ?? kpis?.totalAssigned ?? 0,
      pending: sum.pending ?? kpis?.pendingJobs ?? 0,
      active: sum.active ?? kpis?.activeJobs ?? 0,
      completed: sum.completed ?? kpis?.completedJobs ?? 0,
      today: sum.today ?? kpis?.todayJobs ?? 0,
    };
  });

  readonly currentPage = signal(1);
  readonly pageSize = signal(5);
  readonly overviewFilter = signal<'this_week' | 'today' | 'this_month' | 'all'>('this_week');

  readonly donutStats = computed(() => {
    const dash = this.dashboard();
    const sum = this.summary();
    const total = dash?.kpis?.totalAssigned ?? sum.assigned ?? 0;
    const completed = dash?.kpis?.completedJobs ?? sum.completed ?? 0;
    const active = dash?.kpis?.activeJobs ?? (sum.inProgress + sum.onHold);
    const pending = dash?.kpis?.pendingJobs ?? (sum.pending ?? 0);

    const cPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const aPct = total > 0 ? Math.round((active / total) * 100) : 0;
    const pPct = total > 0 ? Math.max(0, 100 - cPct - aPct) : 0;

    const C = 238.76;
    const cLen = (cPct / 100) * C;
    const aLen = (aPct / 100) * C;
    const pLen = (pPct / 100) * C;

    return {
      total,
      completed,
      active,
      pending,
      completedPct: cPct,
      activePct: aPct,
      pendingPct: pPct,
      completedDash: `${cLen} ${C}`,
      completedOffset: 0,
      activeDash: `${aLen} ${C}`,
      activeOffset: -cLen,
      pendingDash: `${pLen} ${C}`,
      pendingOffset: -(cLen + aLen),
    };
  });

  getCurrentJobStep(status?: string): number {
    if (
      status === 'inspection_approved' ||
      status === 'inspection_in_progress' ||
      status === 'awaiting_customer_approval' ||
      status === 'in_progress' ||
      status === 'on_hold'
    ) return 2;
    if (status === 'repair_completed' || status === 'ready_for_pickup' || status === 'picked_up') return 3;
    if (status === 'completed') return 4;
    return 1;
  }

  readonly visibleJobs = computed(() => {
    const query = this.searchText().trim().toLocaleLowerCase();
    let list = this.jobs().filter((job) => {
      if (!query) return true;
      return [job.id, job.appliance, job.brand, job.model, job.customer || '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query);
    });

    if (this.sortBy() === 'scheduled') {
      list = [...list].sort((a, b) => {
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });
    } else if (this.sortBy() === 'appliance') {
      list = [...list].sort((a, b) => a.appliance.localeCompare(b.appliance));
    } else {
      list = [...list].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
    }

    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.visibleJobs().length / this.pageSize())));

  readonly pagesArray = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly pageStart = computed(() => {
    const len = this.visibleJobs().length;
    if (!len) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly pageEnd = computed(() => {
    const len = this.visibleJobs().length;
    return Math.min(this.currentPage() * this.pageSize(), len);
  });

  readonly pagedJobs = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.visibleJobs().slice(start, start + this.pageSize());
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getCustomerName(repair?: TechnicianRepairDetails | TechnicianJob | null): string {
    if (!repair) return 'Customer';
    if (typeof repair.customer === 'string' && repair.customer) return repair.customer;
    return (repair.customer as { name?: string })?.name || (repair as { customerName?: string }).customerName || 'Customer';
  }

  isActiveJobsRoute(): boolean {
    return this.route.snapshot.data['technicianView'] === 'active';
  }

  isCompletedJobsRoute(): boolean {
    return this.route.snapshot.data['technicianView'] === 'completed';
  }

  getCustomerPhone(repair?: TechnicianRepairDetails | TechnicianJob | null): string {
    if (!repair) return 'Not provided';
    if (repair.phone) return repair.phone;
    if (typeof repair.customer === 'object' && (repair.customer as { phone?: string })?.phone) {
      return (repair.customer as { phone?: string }).phone || 'Not provided';
    }
    return 'Not provided';
  }

  onViewActiveJob(): void {
    const job = this.dashboard()?.currentlyActiveJob;
    if (job) {
      this.viewJob(job);
    } else {
      this.setFilter('active');
      this.view.set('jobs');
    }
  }

  getCustomerAddress(repair?: TechnicianRepairDetails | TechnicianJob | null): string {
    if (!repair) return 'Not provided';
    if (repair.address) return repair.address;
    const loc = (repair as TechnicianRepairDetails)?.location || (typeof repair.customer === 'object' && (repair.customer as { location?: { latitude?: number; longitude?: number } })?.location);
    if (loc && typeof loc.latitude === 'number') {
      return `${loc.latitude.toFixed(4)}, ${loc.longitude?.toFixed(4)}`;
    }
    return 'Not provided';
  }

  getQuotationCurrency(repair?: TechnicianRepairDetails | null): string {
    const cur = repair?.quotation?.currency;
    if (!cur || cur === 'INR') return '₹';
    return cur;
  }

  getStepperAssignedDate(repair?: TechnicianRepairDetails | null): string {
    const assigned = repair?.assignedAt || repair?.assignmentDetails?.assignedAt;
    if (assigned) {
      const d = new Date(assigned);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
               d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
    return 'Assigned';
  }

  getStepperInspectionDate(repair?: TechnicianRepairDetails | null): string {
    const timeline = repair?.timeline || [];
    const inspectEvent = timeline.find((t) => t.action === 'inspection_started' || t.action === 'inspection');
    if (inspectEvent?.at) {
      const d = new Date(inspectEvent.at);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
               d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
    const started = repair?.repairJobDetails?.startedAt;
    if (started) {
      const d = new Date(started);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
               d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
    return 'Inspection';
  }

  ngOnInit(): void {
    const routeView = this.route.snapshot.data['technicianView'] as TechnicianPageView;
    if (routeView) {
      this.view.set(routeView);
      this.focusFirstJobOnLoad = routeView === 'jobs';
      if (routeView === 'active') this.filter.set('active');
      if (routeView === 'completed') this.filter.set('completed');
    }

    this.service.myProfile().subscribe({
      next: (profile) => this.technician.set(profile),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Technician profile could not be loaded.'),
    });

    if (this.view() === 'dashboard') {
      this.loadDashboard();
    } else {
      const initialFilter = this.view() === 'history' ? 'history' : this.filter();
      this.loadJobs(initialFilter);
    }

    // Handle query param or route param for job selection
    this.route.paramMap.subscribe((params) => {
      const jobId = params.get('id');
      if (jobId) {
        this.view.set('job-detail');
        this.openJobById(jobId);
      }
    });

    this.route.queryParamMap.subscribe((params) => {
      const jobId = params.get('jobId');
      if (jobId) {
        this.view.set('job-detail');
      }
      if (jobId && this.selectedJobId() !== jobId) {
        this.openJobById(jobId);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearInspectionImagePreviews();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .dashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.dashboard.set(data);
          this.technician.set(data.technician);
          if (data.kpis) {
            this.summary.set({
              assigned: data.kpis.totalAssigned ?? 0,
              pending: data.kpis.pendingJobs ?? 0,
              active: data.kpis.activeJobs ?? 0,
              inProgress: data.kpis.activeJobs ?? 0,
              completed: data.kpis.completedJobs ?? 0,
              onHold: 0,
              today: data.kpis.todayJobs ?? 0,
            });
          }
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message || 'Dashboard data could not be loaded.');
        },
      });
  }

  setFilter(filter: JobFilter): void {
    this.filter.set(filter);
    this.currentPage.set(1);
    this.loadJobs(filter);
  }

  viewJob(job: TechnicianJob): void {
    if (this.isActiveJobsRoute()) this.detailTab.set('details');
    this.view.set('job-detail');
    this.openJob(job);
  }

  backToJobs(): void {
    if (this.isActiveJobsRoute()) {
      this.view.set('active');
      return;
    }
    if (this.isCompletedJobsRoute()) {
      this.view.set('completed');
      this.router.navigate(['/technician/completed-jobs']);
      return;
    }
    this.view.set('jobs');
    this.router.navigate(['/technician/jobs']);
  }

  loadJobs(filter: JobFilter | 'history'): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .myJobs(filter)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const list = result.jobs || [];
          this.jobs.set(list);
          this.summary.set(result.summary || EMPTY_SUMMARY);
          const shouldFocusFirstJob = this.focusFirstJobOnLoad;
          this.focusFirstJobOnLoad = false;
          const targetId = this.selectedJobId();
          const target = list.find((j) => j.id === targetId);
          if (this.isActiveJobsRoute() && this.view() !== 'job-detail') {
            this.details.set(null);
            this.selectedJobId.set(list[0]?.id || '');
          } else if (target) {
            this.openJob(target);
          } else if (list.length > 0) {
            if (shouldFocusFirstJob) {
              this.view.set('job-detail');
            }
            this.openJob(list[0]);
          } else {
            this.details.set(null);
            this.selectedJobId.set('');
          }
        },
        error: (error: HttpErrorResponse) => {
          this.jobs.set([]);
          this.summary.set(EMPTY_SUMMARY);
          this.details.set(null);
          this.selectedJobId.set('');
          this.error.set(error.error?.message || 'Failed to load assigned jobs.');
        },
      });
  }

  openJob(job: TechnicianJob): void {
    this.selectedJobId.set(job.id);
    this.openJobById(job.id);
  }

  openJobById(jobId: string): void {
    if (!jobId) return;
    this.selectedJobId.set(jobId);
    this.detailLoading.set(true);
    this.error.set('');
    this.service.myJobDetails(jobId).subscribe({
      next: (details) => {
        this.details.set(details);
        this.populateInspectionForm(details.inspection || details.repairJobDetails?.inspection);
        this.detailLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.details.set(null);
        this.detailLoading.set(false);
        this.error.set(error.error?.message || 'Failed to load job details.');
      },
    });
  }

  closeDetails(): void {
    this.details.set(null);
    this.selectedJobId.set('');
  }

  confirmStartJob(targetId?: string, targetName?: string): void {
    const repair = this.details();
    const id = targetId || repair?.id;
    const name = targetName || repair?.appliance || 'this appliance';
    if (!id) return;
    this.confirmation.set({
      title: 'Start Repair Work',
      message: `Are you ready to begin work on ${name}? This will update the job to In Progress and notify both the shop and customer.`,
      confirmLabel: 'Start Job',
      cancelLabel: 'Cancel',
    });
    this.pendingAction = () => {
      this.updating.set(true);
      this.service.startJob(id, 'Technician began repair work.').subscribe({
        next: () => {
          this.updating.set(false);
          this.toast.show({
            title: 'Repair Started',
            message: `Work has begun on ${name}.`,
            type: 'success',
          });
          if (this.view() === 'dashboard') {
            this.loadDashboard();
          } else {
            this.openJobById(id);
            this.loadJobs(this.filter());
          }
        },
        error: (err: HttpErrorResponse) => {
          this.updating.set(false);
          this.error.set(err.error?.message || 'Could not start this repair job.');
        },
      });
    };
  }

  confirmHoldJob(targetId?: string, targetName?: string): void {
    const repair = this.details();
    const id = targetId || repair?.id;
    const name = targetName || repair?.appliance || 'this appliance';
    if (!id) return;
    this.confirmation.set({
      title: 'Place Repair On Hold',
      message: `Place work on hold for ${name}? You can resume work at any time.`,
      confirmLabel: 'Place On Hold',
      cancelLabel: 'Cancel',
      reasonLabel: 'Reason for pause (e.g. waiting for parts, shop confirmation)',
      reasonPlaceholder: 'Enter reason for placing on hold…',
      reasonRequired: true,
    });
    this.pendingAction = (reason?: string) => {
      this.updating.set(true);
      this.service.holdJob(id, reason || 'Placed on hold by technician.').subscribe({
        next: () => {
          this.updating.set(false);
          this.toast.show({
            title: 'Job Placed On Hold',
            message: `Repair on ${name} has been paused.`,
            type: 'info',
          });
          if (this.view() === 'dashboard') {
            this.loadDashboard();
          } else {
            this.openJobById(id);
            this.loadJobs(this.filter());
          }
        },
        error: (err: HttpErrorResponse) => {
          this.updating.set(false);
          this.error.set(err.error?.message || 'Could not place this job on hold.');
        },
      });
    };
  }

  openProgressModal(): void {
    this.progressNote.set('');
    this.progressModalOpen.set(true);
  }

  closeProgressModal(): void {
    this.progressModalOpen.set(false);
    this.progressNote.set('');
  }

  submitProgress(): void {
    const repair = this.details();
    const note = this.progressNote().trim();
    if (!repair || !note) return;
    this.updating.set(true);
    this.service.updateProgress(repair.id, note).subscribe({
      next: () => {
        this.updating.set(false);
        this.closeProgressModal();
        this.toast.show({
          title: 'Progress Updated',
          message: 'Your progress note has been recorded.',
          type: 'success',
        });
        this.openJobById(repair.id);
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        this.error.set(err.error?.message || 'Could not save progress note.');
      },
    });
  }

  openCompletionModal(): void {
    this.completionDescription.set('');
    this.workPerformed.set('');
    this.partsReplaced.set('');
    this.finalNotes.set('');
    this.completionModalOpen.set(true);
  }

  closeCompletionModal(): void {
    this.completionModalOpen.set(false);
  }

  submitCompletion(): void {
    const repair = this.details();
    const summary = this.completionDescription().trim();
    const work = this.workPerformed().trim();
    if (!repair || !summary || !work) {
      this.error.set('Please provide both completion summary and work performed description.');
      return;
    }
    this.updating.set(true);
    this.service
      .completeJob(repair.id, {
        completionDescription: summary,
        workPerformed: work,
        partsReplaced: this.partsReplaced().trim() || undefined,
        finalNotes: this.finalNotes().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.updating.set(false);
          this.closeCompletionModal();
          this.toast.show({
            title: 'Repair Completed',
            message: `Repair on ${repair.appliance} marked completed. The shop has been notified for pickup verification.`,
            type: 'success',
          });
          this.openJobById(repair.id);
          this.loadJobs(this.filter());
        },
        error: (err: HttpErrorResponse) => {
          this.updating.set(false);
          this.error.set(err.error?.message || 'Could not complete this repair job.');
        },
      });
  }

  onDialogConfirmed(reason?: string): void {
    this.confirmation.set(null);
    if (this.pendingAction) {
      (this.pendingAction as (r?: string) => void)(reason);
      this.pendingAction = undefined;
    }
  }

  onDialogCancelled(): void {
    this.confirmation.set(null);
    this.pendingAction = undefined;
  }

  messageCustomer(): void {
    const repair = this.details();
    if (!repair || this.messaging()) return;
    this.messaging.set(true);
    this.chat.createConversation(repair.id, repair.shopId).subscribe({
      next: (conversation) => {
        this.messaging.set(false);
        void this.router.navigate(['/technician/messages'], {
          queryParams: { conversationId: conversation.id },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.messaging.set(false);
        this.error.set(error.error?.message || 'Could not open conversation with customer.');
      },
    });
  }

  messageShop(): void {
    const repair = this.details();
    if (!repair || this.messaging()) return;
    this.messaging.set(true);
    this.chat.createConversation(repair.id, repair.shopId).subscribe({
      next: (conversation) => {
        this.messaging.set(false);
        void this.router.navigate(['/technician/messages'], {
          queryParams: { conversationId: conversation.id },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.messaging.set(false);
        this.error.set(error.error?.message || 'Could not open conversation with shop.');
      },
    });
  }

  openLightbox(photoUrl: string): void {
    this.lightboxImage.set(photoUrl);
  }

  closeLightbox(): void {
    this.lightboxImage.set(null);
  }

  // =========================================================================
  // INSPECTION & CHECKING WORKFLOW
  // =========================================================================

  partsTotal(parts: RepairEstimatePartInput[]): number {
    return Math.round(
      parts.reduce(
        (sum, p) =>
          sum + Math.max(1, +p.quantity || 1) * Math.max(0, +p.unitPrice || 0),
        0,
      ) * 100,
    ) / 100;
  }

  nonEmptyParts(parts: RepairEstimatePartInput[]): RepairEstimatePartInput[] {
    return parts
      .filter((p) => p.name.trim().length > 0)
      .map((p) => ({
        name: p.name.trim(),
        quantity: Math.max(1, Math.round(+p.quantity || 1)),
        unitPrice: Math.max(0, Math.round((+p.unitPrice || 0) * 100) / 100),
      }));
  }

  addInspectionPart(): void {
    this.inspectionParts.update((list) => [
      ...list,
      { name: '', quantity: 1, unitPrice: 0 },
    ]);
  }

  removeInspectionPart(index: number): void {
    this.inspectionParts.update((list) => {
      if (list.length <= 1) return [{ name: '', quantity: 1, unitPrice: 0 }];
      return list.filter((_, i) => i !== index);
    });
  }

  updateInspectionPart(
    index: number,
    field: 'name' | 'quantity' | 'unitPrice',
    value: string | number,
  ): void {
    this.inspectionParts.update((list) =>
      list.map((part, i) => {
        if (i !== index) return part;
        if (field === 'name') return { ...part, name: String(value) };
        if (field === 'quantity') return { ...part, quantity: Math.max(1, +value || 1) };
        if (field === 'unitPrice') return { ...part, unitPrice: Math.max(0, +value || 0) };
        return part;
      }),
    );
  }

  chooseInspectionImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.inspectionImagesError.set('');
    if (!files.length) return;
    if (
      files.some(
        (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      )
    ) {
      this.inspectionImagesError.set('Please select JPEG, PNG, or WebP images only.');
      input.value = '';
      return;
    }
    if (files.some((file) => file.size > 2_000_000)) {
      this.inspectionImagesError.set('Each image must be smaller than 2 MB.');
      input.value = '';
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 1_200_000) {
      this.inspectionImagesError.set('The selected images must total no more than 1.2 MB.');
      input.value = '';
      return;
    }
    this.clearInspectionImagePreviews();
    this.inspectionImages.set(files);
    this.inspectionImagePreviews.set(
      files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    );
  }

  removeInspectionImage(index: number): void {
    const preview = this.inspectionImagePreviews()[index];
    if (preview) URL.revokeObjectURL(preview.url);
    this.inspectionImages.update((files) => files.filter((_, fileIndex) => fileIndex !== index));
    this.inspectionImagePreviews.update((previews) =>
      previews.filter((_, previewIndex) => previewIndex !== index),
    );
  }

  cancelInspectionForm(repair: TechnicianRepairDetails): void {
    this.populateInspectionForm(repair.inspection || repair.repairJobDetails?.inspection);
    this.error.set('');
    this.detailTab.set('details');
  }

  private clearInspectionImagePreviews(): void {
    this.inspectionImagePreviews().forEach((preview) => URL.revokeObjectURL(preview.url));
    this.inspectionImagePreviews.set([]);
  }

  async encodeImages(
    files: File[],
  ): Promise<Array<{ mimeType: string; data: string }>> {
    return Promise.all(
      files.map(
        (file) =>
          new Promise<{ mimeType: string; data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                mimeType: file.type,
                data: String(reader.result || ''),
              });
            };
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );
  }

  populateInspectionForm(inspection?: RepairInspectionReport | null): void {
    this.clearInspectionImagePreviews();
    if (inspection) {
      this.identifiedProblem.set(inspection.identifiedProblem ?? '');
      this.findings.set(inspection.findings ?? '');
      this.requiredRepairWork.set(inspection.requiredRepairWork ?? '');
      const parts = inspection.parts ?? [];
      this.inspectionParts.set(
        parts.length
          ? parts.map(({ name, quantity, unitPrice }) => ({
              name,
              quantity,
              unitPrice,
            }))
          : [{ name: '', quantity: 1, unitPrice: 0 }],
      );
      this.inspectionLabour.set(inspection.labourCharge ?? 0);
      this.inspectionCharge.set(inspection.inspectionCharges ?? 0);
      this.inspectionOtherCharges.set(inspection.otherCharges ?? 0);
      this.inspectionTime.set(inspection.estimatedTimeValue ?? null);
      this.inspectionTimeUnit.set(inspection.estimatedTimeUnit ?? 'days');
      this.inspectionWarranty.set(inspection.warranty ?? '');
      this.inspectionMessage.set(inspection.message ?? '');
    } else {
      this.identifiedProblem.set('');
      this.findings.set('');
      this.requiredRepairWork.set('');
      this.inspectionParts.set([{ name: '', quantity: 1, unitPrice: 0 }]);
      this.inspectionLabour.set(0);
      this.inspectionCharge.set(0);
      this.inspectionOtherCharges.set(0);
      this.inspectionTime.set(null);
      this.inspectionTimeUnit.set('days');
      this.inspectionWarranty.set('');
      this.inspectionMessage.set('');
    }
    this.inspectionImages.set([]);
    this.inspectionImagesError.set('');
  }

  openInspectionModal(targetId?: string, applianceName?: string): void {
    const id = targetId || this.details()?.id || '';
    const name = applianceName || this.details()?.appliance || 'Device';
    this.inspectionTargetId.set(id);
    this.inspectionTargetName.set(name);
    if (this.details()?.id === id) {
      this.populateInspectionForm(
        this.details()?.inspection || this.details()?.repairJobDetails?.inspection,
      );
    } else if (id) {
      this.service.myJobDetails(id).subscribe({
        next: (d) => {
          this.populateInspectionForm(
            d.inspection || d.repairJobDetails?.inspection,
          );
        },
      });
    }
    this.inspectionModalOpen.set(true);
  }

  closeInspectionModal(): void {
    this.inspectionModalOpen.set(false);
    this.inspectionImagesError.set('');
    this.clearInspectionImagePreviews();
  }

  confirmStartInspection(targetId?: string, targetName?: string): void {
    const repair = this.details();
    const id = targetId || repair?.id;
    const name = targetName || repair?.appliance || 'this appliance';
    if (!id) return;

    this.confirmation.set({
      title: 'Start Inspection & Checking',
      message: `Begin diagnosis and physical inspection of ${name}? This updates the job to Inspection In Progress and notifies the customer.`,
      confirmLabel: 'Start Inspection',
      cancelLabel: 'Cancel',
    });
    this.pendingAction = () => {
      this.updating.set(true);
      this.service.startInspection(id).subscribe({
        next: () => {
          this.updating.set(false);
          this.toast.show({
            title: 'Inspection Started',
            message: `Inspection in progress for ${name}.`,
            type: 'success',
          });
          if (this.view() === 'dashboard') {
            this.loadDashboard();
            this.openInspectionModal(id, name);
          } else {
            this.openJobById(id);
            this.loadJobs(this.filter());
            this.detailTab.set('inspection');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.updating.set(false);
          this.error.set(
            err.error?.message || 'Could not start inspection for this repair.',
          );
        },
      });
    };
  }

  async saveInspection(action: 'draft' | 'submit'): Promise<void> {
    const targetId = this.inspectionTargetId() || this.details()?.id;
    if (!targetId || this.submittingInspection()) return;

    if (
      action === 'submit' &&
      (!this.identifiedProblem().trim() ||
        !this.findings().trim() ||
        !this.requiredRepairWork().trim() ||
        this.inspectionTotal() <= 0)
    ) {
      this.error.set(
        'Please complete all required diagnosis fields and enter a valid repair estimate greater than zero.',
      );
      return;
    }

    try {
      this.submittingInspection.set(true);
      this.error.set('');

      const input: InspectionReportInput = {
        action,
        identifiedProblem: this.identifiedProblem().trim(),
        findings: this.findings().trim(),
        requiredRepairWork: this.requiredRepairWork().trim(),
        parts: this.nonEmptyParts(this.inspectionParts()),
        labourCharge: Math.max(0, +this.inspectionLabour() || 0),
        inspectionCharges: Math.max(0, +this.inspectionCharge() || 0),
        otherCharges: Math.max(0, +this.inspectionOtherCharges() || 0),
        estimatedTimeValue: this.inspectionTime() ?? undefined,
        estimatedTimeUnit: this.inspectionTimeUnit(),
        warranty: this.inspectionWarranty().trim() || undefined,
        images: this.inspectionImages().length
          ? await this.encodeImages(this.inspectionImages())
          : undefined,
        message: this.inspectionMessage().trim() || undefined,
      };

      this.service.saveInspection(targetId, input).subscribe({
        next: () => {
          this.submittingInspection.set(false);
          this.closeInspectionModal();
          this.toast.show({
            title:
              action === 'submit'
                ? 'Inspection Report Submitted'
                : 'Inspection Draft Saved',
            message:
              action === 'submit'
                ? 'Report has been sent to customer for review and approval.'
                : 'Inspection draft has been saved successfully.',
            type: 'success',
          });
          if (this.view() === 'dashboard') {
            this.loadDashboard();
          } else {
            this.openJobById(targetId);
            this.loadJobs(this.filter());
          }
        },
        error: (err: HttpErrorResponse) => {
          this.submittingInspection.set(false);
          this.error.set(
            err.error?.message || 'Failed to save inspection report.',
          );
        },
      });
    } catch (err) {
      this.submittingInspection.set(false);
      this.error.set(
        err instanceof Error
          ? err.message
          : 'Error processing inspection images.',
      );
    }
  }

  confirmStartApprovedRepair(targetId?: string, targetName?: string): void {
    const repair = this.details();
    const id = targetId || repair?.id;
    const name = targetName || repair?.appliance || 'this appliance';
    if (!id) return;

    this.confirmation.set({
      title: 'Start Customer-Approved Repair',
      message: `Customer has approved the inspection estimate. Start repair work on ${name} now?`,
      confirmLabel: 'Start Repair',
      cancelLabel: 'Cancel',
    });
    this.pendingAction = () => {
      this.updating.set(true);
      this.service.startApprovedRepair(id).subscribe({
        next: () => {
          this.updating.set(false);
          this.toast.show({
            title: 'Repair Started',
            message: `Work has begun on ${name}.`,
            type: 'success',
          });
          if (this.view() === 'dashboard') {
            this.loadDashboard();
          } else {
            this.openJobById(id);
            this.loadJobs(this.filter());
          }
        },
        error: (err: HttpErrorResponse) => {
          this.updating.set(false);
          this.error.set(err.error?.message || 'Could not start repair.');
        },
      });
    };
  }
}
