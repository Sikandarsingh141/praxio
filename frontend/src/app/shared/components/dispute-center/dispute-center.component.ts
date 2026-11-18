import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerPortalService } from '../../../customer/services/customer-portal.service';
import { CustomerRepairRequest } from '../../../customer/models/customer-portal.models';
import { ShopRepairRouteComponent } from '../../../shop/repair-job-details/components/shop-repair-route.component';
import {
  AdminMapEntity,
  AdminRepairJob,
  AdminService,
} from '../../../admin/services/admin.service';
import {
  DisputeAccessRole,
  DisputeAttachment,
  DisputeCategory,
  DisputeListResult,
  DisputePriority,
  DisputeRole,
  DisputeStatus,
  RepairDispute,
} from '../../models/disputes.models';
import { DisputesService } from '../../services/disputes.service';
import { environment } from '../../../../environments/environment';
import { profileImageSource } from '../../utils/appliance-thumbnail.util';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../filters/common-filter.component';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../confirmation-dialog/confirmation-dialog.component';
import { JobPaginationComponent } from '../job-pagination/job-pagination.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { AdminPageHeaderComponent } from '../page-header/admin-page-header.component';
import { ToastService } from '../../../core/toast/toast.service';

type DisputeConfirmationAction =
  | 'confirmResolution'
  | 'closeAdminDispute';

const DISPUTE_CATEGORIES: Array<{ value: DisputeCategory; label: string }> = [
  { value: 'same_issue_exists', label: 'Same issue still exists' },
  { value: 'repair_quality', label: 'Repair quality' },
  { value: 'device_not_working', label: 'Device is not working properly' },
  { value: 'new_issue_discovered', label: 'New issue discovered' },
  { value: 'unauthorized_work', label: 'Unauthorized work' },
  { value: 'incorrect_charges', label: 'Incorrect charges' },
  { value: 'overcharge', label: 'Overcharge' },
  { value: 'incomplete_repair', label: 'Incomplete repair' },
  { value: 'item_not_returned', label: 'Item not returned' },
  { value: 'device_damaged', label: 'Device damaged' },
  { value: 'shop_unresponsive', label: 'Shop unresponsive' },
  { value: 'payment', label: 'Payment issue' },
  { value: 'collection', label: 'Collection issue' },
  { value: 'other', label: 'Other' },
];

const DISPUTE_REVIEW_PROGRESS_STATUSES: DisputeStatus[] = [
  'UNDER_REVIEW',
  'ACCEPTED',
  'AWAITING_SHOP_RESPONSE',
  'AWAITING_CUSTOMER_RESPONSE',
  'REINSPECTION_IN_PROGRESS',
];
const DISPUTE_RESOLUTION_PROGRESS_STATUSES: DisputeStatus[] = [
  'RESOLUTION_PROPOSED',
  'AWAITING_CUSTOMER_APPROVAL',
  'REPAIR_IN_PROGRESS',
  'CUSTOMER_VERIFICATION_PENDING',
];
const DISPUTE_COMPLETE_PROGRESS_STATUSES: DisputeStatus[] = [
  'CLOSED',
  'RESOLVED',
  'REJECTED',
  'CUSTOMER_CONFIRMED',
];

@Component({
  selector: 'app-dispute-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CommonFilterComponent,
    ConfirmationDialogComponent,
    JobPaginationComponent,
    PaginationComponent,
    AdminPageHeaderComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './dispute-center.component.html',
  styleUrl: './dispute-center.component.scss',
})
export class DisputeCenterComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  readonly role = signal<DisputeAccessRole>('customer');
  readonly mode = signal<'list' | 'detail' | 'create'>('list');
  readonly loading = signal(true);
  readonly searchLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly list = signal<DisputeListResult | null>(null);
  readonly dispute = signal<RepairDispute | null>(null);
  readonly mapLocations = signal<AdminMapEntity | null>(null);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly adminRepairDetails = signal<AdminRepairJob | null>(null);
  readonly adminRepairDetailsLoading = signal(false);
  readonly adminRepairDetailsError = signal('');
  readonly adminCustomerImageUnavailable = signal(false);
  readonly adminShopImageUnavailable = signal(false);
  readonly repairSummary = signal<{
    appliance: string;
    brand?: string;
    model?: string;
    status?: string;
  } | null>(null);
  readonly raiseDisputeDialogOpen = signal(false);
  readonly investigationNotesModalOpen = signal(false);
  readonly closeDisputeModalOpen = signal(false);
  readonly adminActionModalOpen = signal(false);
  readonly adminActionModalView = signal<'choose' | 'status' | 'complete'>('choose');
  readonly eligibleRepairRequests = signal<CustomerRepairRequest[]>([]);
  readonly eligibleRepairRequestsLoading = signal(false);
  readonly eligibleRepairRequestsError = signal('');
  readonly raiseDisputeFormError = signal('');
  readonly categories = DISPUTE_CATEGORIES;
  readonly adminDirectionsLoader = (requestId: string) =>
    this.adminService.getMapRoute(requestId);
  readonly disputeProgressSteps = [
    'Dispute submitted',
    'Under review',
    'Resolution',
    'Resolved / closed',
  ];
  readonly activeAttachmentUrls = new Map<string, string>();
  readonly appliedFilters = signal<FilterValues>({});
  filterConfig: FilterConfig = this.createFilterConfig('customer');

  search = '';
  statusFilter: DisputeStatus | '' = '';
  datePreset: 'all' | '7' | '30' | '90' = 'all';
  priorityFilter: DisputePriority | '' = '';
  fromDate = '';
  toDate = '';
  sortOrder: 'newest' | 'oldest' | 'priority' = 'newest';
  category = 'repair_quality';
  selectedRepairRequestId = '';
  description = '';
  customerComments = '';
  attachments: DisputeAttachment[] = [];
  conversationAttachments: DisputeAttachment[] = [];
  completionDocuments: DisputeAttachment[] = [];
  message = '';
  selectedPriority: DisputePriority = 'normal';
  internalNote = '';
  rejectionReason = '';
  rejectionExplanation = '';
  shopResponseExplanation = '';
  shopResponseMessage = '';
  shopProposedResolution = '';
  reinspectionFindings = '';
  requiredRepairWork = '';
  estimatedCompletionTime = '';
  chargeReason = '';
  chargeItems: Array<{ description: string; amount: number | null }> = [
    { description: '', amount: null },
  ];
  chargeMessage = '';
  progressNotes = '';
  reworkDescription = '';
  partsReplaced = '';
  testingResults = '';
  finalNotes = '';
  reworkTested = false;
  verificationNotes = '';
  unresolvedNotes = '';
  closeReason = '';
  adminStatus: DisputeStatus = 'UNDER_REVIEW';
  adminStatusReason = '';
  resolutionType = 'repair_again';
  resolutionDescription = '';
  resolutionNotes = '';
  resolutionAmount: number | null = null;
  resolutionResponsibleParty = 'shop';
  resolutionDecisionReason = '';
  resolutionCompletionNotes = '';
  refundTransactionId = '';
  requiredActionCompleted = false;

  private repairRequestId = '';
  private confirmationAction: DisputeConfirmationAction | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly disputes: DisputesService,
    private readonly customerPortal: CustomerPortalService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {
    const segments = this.router.url.split('?')[0].split('/').filter(Boolean);
    const requestedRole = segments[0];
    this.role.set(
      requestedRole === 'admin' ||
        requestedRole === 'shop' ||
        requestedRole === 'technician'
        ? requestedRole
        : 'customer',
    );
    this.filterConfig = this.createFilterConfig(this.role());
    this.route.paramMap.subscribe((params) => {
      this.error.set('');
      this.notice.set('');
      this.dispute.set(null);
      this.repairRequestId = params.get('repairRequestId') ?? '';
      const id = params.get('id');
      if (this.repairRequestId) {
        this.mode.set('create');
        this.loadRepairSummary();
      } else if (id) {
        this.mode.set('detail');
        this.loadDetail(id);
      } else {
        this.mode.set('list');
        this.loadList();
      }
    });
    this.route.queryParamMap.subscribe((params) => {
      const description = params.get('description');
      if (description && this.mode() === 'create') {
        this.description = description;
      }
    });
  }

  page = 1;
  pageSize = 10;

  private createFilterConfig(role: DisputeAccessRole): FilterConfig {
    return {
      title: 'Dispute filters',
      fields: [
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          placeholder: 'All categories',
          options: DISPUTE_CATEGORIES.map(({ value, label }) => ({ value, label })),
        },
        ...(role === 'admin'
          ? [
              {
                key: 'priority',
                label: 'Priority',
                type: 'select' as const,
                placeholder: 'All priorities',
                options: [
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ],
              },
            ]
          : []),
        {
          key: 'sort',
          label: 'Sort',
          type: 'select',
          options: [
            { value: 'newest', label: 'Recently updated' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'priority', label: 'Priority' },
          ],
          defaultValue: 'newest',
        },
      ],
    };
  }

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    this.categoryFilter = this.filterCategory(filters['category']);
    this.priorityFilter = this.filterPriority(filters['priority']);
    const sort = filters['sort'];
    this.sortOrder =
      sort === 'oldest' || sort === 'priority' ? sort : 'newest';
    this.page = 1;
    this.loadList();
  }

  applyListControls(searchRequest = false): void {
    this.page = 1;
    this.loadList(searchRequest);
  }

  setStatusFilter(value: string): void {
    this.statusFilter = this.filterStatus(value);
    this.applyListControls();
  }

  setDatePreset(value: 'all' | '7' | '30' | '90'): void {
    this.datePreset = value;
    if (value === 'all') {
      this.fromDate = '';
      this.toDate = '';
    } else {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - Number(value));
      this.fromDate = this.localDateString(start);
      this.toDate = this.localDateString(end);
    }
    this.applyListControls();
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private filterStatus(value: FilterValues[string]): DisputeStatus | '' {
    const statuses: DisputeStatus[] = [
      'OPEN',
      'UNDER_REVIEW',
      'AWAITING_SHOP_RESPONSE',
      'AWAITING_CUSTOMER_RESPONSE',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'ACCEPTED',
      'REINSPECTION_IN_PROGRESS',
      'AWAITING_CUSTOMER_APPROVAL',
      'REPAIR_IN_PROGRESS',
      'CUSTOMER_VERIFICATION_PENDING',
      'CUSTOMER_CONFIRMED',
      'REOPENED',
      'RESOLUTION_PROPOSED',
    ];
    return typeof value === 'string' && statuses.includes(value as DisputeStatus)
      ? (value as DisputeStatus)
      : '';
  }

  private filterCategory(value: FilterValues[string]): DisputeCategory | '' {
    return typeof value === 'string' &&
      DISPUTE_CATEGORIES.some((category) => category.value === value)
      ? (value as DisputeCategory)
      : '';
  }

  private filterPriority(value: FilterValues[string]): DisputePriority | '' {
    const priorities: DisputePriority[] = ['low', 'normal', 'high', 'urgent'];
    return typeof value === 'string' && priorities.includes(value as DisputePriority)
      ? (value as DisputePriority)
      : '';
  }

  goToPage(page: number): void {
    const totalPages = this.list()?.pagination.totalPages ?? 1;
    if (page < 1 || page > totalPages || page === this.page) return;
    this.page = page;
    this.loadList();
  }

  disputeDetailLink(disputeId: string): string[] {
    const currentRoute = this.router.url.split('?')[0].replace(/\/+$/, '');
    const roleListRoute = `/${this.role()}/jobs/disputed-jobs`;
    const baseRoute =
      currentRoute === roleListRoute ? roleListRoute : `/${this.role()}/disputes`;
    return [baseRoute, disputeId];
  }

  normalizedImageSource(value?: string | null): string | null {
    return profileImageSource(value);
  }

  adminCustomerPhotoSource(value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.adminCustomerImageUnavailable() ? source : null;
  }

  adminShopPhotoSource(value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.adminShopImageUnavailable() ? source : null;
  }

  customerInitials(name?: string): string {
    const initials = (name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('');
    return initials.toUpperCase() || 'CU';
  }

  disputeListLink(): string[] {
    const currentRoute = this.router.url.split('?')[0].replace(/\/+$/, '');
    const roleListRoute = `/${this.role()}/jobs/disputed-jobs`;
    return [currentRoute.startsWith(`${roleListRoute}/`) ? roleListRoute : `/${this.role()}/disputes`];
  }

  repairDetailsLink(repairId: string): string[] {
    if (this.role() === 'technician') {
      return ['/technician/assigned-jobs', repairId];
    }
    if (this.role() === 'admin') {
      return ['/admin/repair-jobs', repairId];
    }
    return [
      this.role() === 'customer' ? '/customer/repair-requests' : '/shop/repair-requests',
      repairId,
    ];
  }

  changePageSize(size: number): void {
    if (![5, 10, 25, 100].includes(size) || size === this.pageSize) return;
    this.pageSize = size;
    this.page = 1;
    this.loadList();
  }

  loadList(searchRequest = false): void {
    searchRequest = searchRequest || Boolean(this.search.trim());
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('The start date must not be later than the end date.');
      this.loading.set(false);
      this.searchLoading.set(false);
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.searchLoading.set(searchRequest);
    this.disputes
      .list(this.role(), {
        search: this.search.trim() || undefined,
        status: this.statusFilter,
        category: this.categoryFilter,
        priority: this.priorityFilter,
        from: this.fromDate,
        to: this.toDate,
        sort: this.sortOrder,
        page: this.page,
        limit: this.pageSize,
      }, { silent: searchRequest })
      .subscribe({
        next: (result) => {
          this.list.set(result);
          this.loading.set(false);
          this.searchLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.searchLoading.set(false);
          this.fail(error, 'Disputes could not be loaded.');
        },
      });
  }

  loadDetail(id: string): void {
    this.loading.set(true);
    this.mapLocations.set(null);
    this.mapLoading.set(false);
    this.mapError.set('');
    this.adminRepairDetails.set(null);
    this.adminRepairDetailsLoading.set(false);
    this.adminRepairDetailsError.set('');
    this.investigationNotesModalOpen.set(false);
    this.closeDisputeModalOpen.set(false);
    this.adminActionModalOpen.set(false);
    this.adminActionModalView.set('choose');
    this.internalNote = '';
    this.closeReason = '';
    this.adminStatusReason = '';
    this.resolutionCompletionNotes = '';
    this.refundTransactionId = '';
    this.requiredActionCompleted = false;
    this.completionDocuments = [];
    this.disputes.get(this.role(), id).subscribe({
      next: (dispute) => {
        this.dispute.set(dispute);
        this.adminStatus = dispute.status;
        this.selectedPriority = dispute.priority;
        if (this.role() === 'admin') {
          this.loadMapLocations(dispute.repairRequestId);
          this.loadAdminRepairDetails(dispute.repairRequestId);
        }
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(
          error,
          this.role() === 'admin'
            ? 'Issue resolution could not be loaded.'
            : 'Issue details could not be loaded.',
        ),
    });
  }

  loadRepairSummary(): void {
    this.loading.set(true);
    this.customerPortal.getRepairJob(this.repairRequestId).subscribe({
      next: (request) => {
        this.repairSummary.set({
          appliance: request.appliance,
          brand: request.brand,
          model: request.model,
          status: request.repairJob?.status ?? request.status,
        });
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Repair details could not be loaded.'),
    });
  }

  openRaiseDisputeDialog(): void {
    this.raiseDisputeDialogOpen.set(true);
    this.eligibleRepairRequestsLoading.set(true);
    this.eligibleRepairRequestsError.set('');
    this.raiseDisputeFormError.set('');
    this.selectedRepairRequestId = '';
    this.description = '';
    this.customerComments = '';
    this.category = 'repair_quality';
    this.attachments = [];
    this.customerPortal.getRepairRequests().subscribe({
      next: (requests) => {
        const eligibleRequests = requests.filter((request) => this.canRaiseDisputeFor(request));
        this.eligibleRepairRequests.set(eligibleRequests);
        this.selectedRepairRequestId = eligibleRequests[0]?._id ?? '';
        this.eligibleRepairRequestsLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.eligibleRepairRequestsError.set(
          error.error?.message || 'Completed repairs could not be loaded.',
        );
        this.eligibleRepairRequestsLoading.set(false);
      },
    });
  }

  closeRaiseDisputeDialog(): void {
    this.raiseDisputeDialogOpen.set(false);
    this.eligibleRepairRequestsError.set('');
    this.raiseDisputeFormError.set('');
    this.selectedRepairRequestId = '';
    this.description = '';
    this.customerComments = '';
    this.category = 'repair_quality';
    this.attachments = [];
  }

  openInvestigationNotesModal(): void {
    this.error.set('');
    this.investigationNotesModalOpen.set(true);
  }

  closeInvestigationNotesModal(): void {
    this.investigationNotesModalOpen.set(false);
  }

  openCloseDisputeModal(): void {
    this.error.set('');
    this.closeDisputeModalOpen.set(true);
  }

  closeCloseDisputeModal(): void {
    this.closeDisputeModalOpen.set(false);
  }

  canManageAdminStatus(dispute: RepairDispute | null = this.dispute()): boolean {
    return !!dispute && dispute.status !== 'CLOSED' && dispute.status !== 'RESOLVED';
  }

  canCompleteAdminResolution(dispute: RepairDispute | null = this.dispute()): boolean {
    return !!dispute && dispute.resolution.state === 'proposed';
  }

  canOpenAdminActionModal(): boolean {
    return this.canManageAdminStatus() || this.canCompleteAdminResolution();
  }

  openAdminActionModal(): void {
    this.error.set('');
    this.investigationNotesModalOpen.set(false);
    this.closeDisputeModalOpen.set(false);
    this.adminActionModalView.set('choose');
    this.adminActionModalOpen.set(true);
  }

  closeAdminActionModal(): void {
    this.adminActionModalOpen.set(false);
    this.adminActionModalView.set('choose');
  }

  showAdminStatusForm(): void {
    if (!this.canManageAdminStatus()) return;
    this.error.set('');
    this.adminActionModalView.set('status');
  }

  showAdminCompletionForm(): void {
    if (!this.canCompleteAdminResolution()) return;
    this.error.set('');
    this.adminActionModalView.set('complete');
  }

  backToAdminActionChoices(): void {
    this.error.set('');
    this.adminActionModalView.set('choose');
  }

  repairRequestOptionLabel(request: CustomerRepairRequest): string {
    const device = [request.brand, request.model].filter(Boolean).join(' ');
    const requestId = `#${request._id.slice(-8).toUpperCase()}`;
    const description = [request.appliance, device].filter(Boolean).join(' · ');
    return `${description} (${requestId})`;
  }

  attachmentSizeLabel(attachment: DisputeAttachment): string {
    const encodedData = attachment.data?.split(',').pop();
    if (!encodedData) return 'File attached';
    const padding = encodedData.endsWith('==') ? 2 : encodedData.endsWith('=') ? 1 : 0;
    const sizeInBytes = Math.max(0, Math.floor((encodedData.length * 3) / 4) - padding);
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
  }

  private canRaiseDisputeFor(request: CustomerRepairRequest): boolean {
    return ['picked_up', 'completed'].includes(request.repairJob?.status ?? request.status);
  }

  createDispute(): void {
    if (!this.description.trim()) {
      this.setRaiseDisputeError('Describe the problem found after receiving the repaired device.');
      return;
    }
    const repairRequestId =
      this.mode() === 'create' ? this.repairRequestId : this.selectedRepairRequestId;
    if (!repairRequestId) {
      this.setRaiseDisputeError('Select a completed repair before raising a dispute.');
      return;
    }
    this.run(
      this.disputes.create(repairRequestId, {
        category: this.category,
        description: this.description.trim(),
        attachments: this.attachments,
        customerComments: this.customerComments.trim() || undefined,
      }),
      'Dispute submitted.',
      (dispute) => void this.router.navigate(['/customer/disputes', dispute._id]),
      this.raiseDisputeDialogOpen() ? this.raiseDisputeFormError : this.error,
    );
  }

  private setRaiseDisputeError(message: string): void {
    if (this.raiseDisputeDialogOpen()) {
      this.raiseDisputeFormError.set(message);
      return;
    }
    this.error.set(message);
  }

  sendMessage(): void {
    const dispute = this.dispute();
    if (!dispute || !this.message.trim()) return;
    this.run(
      this.disputes.sendMessage(this.writableRole, dispute._id, {
        message: this.message.trim(),
        attachments: this.conversationAttachments,
      }),
      'Message sent.',
      (updated) => {
        this.message = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  addInternalNote(): void {
    const dispute = this.dispute();
    if (!dispute || !this.internalNote.trim()) return;
    this.run(
      this.disputes.addInternalNote(dispute._id, this.internalNote.trim()),
      'Private note saved.',
      (updated) => {
        this.internalNote = '';
        this.investigationNotesModalOpen.set(false);
        this.dispute.set(updated);
      },
    );
  }

  updateAdminStatus(): void {
    const dispute = this.dispute();
    if (!dispute || !this.adminStatusReason.trim()) {
      this.error.set('Add a reason for the status change.');
      return;
    }
    this.run(
      this.disputes.updateAdminStatus(dispute._id, {
        status: this.adminStatus,
        reason: this.adminStatusReason.trim(),
        priority: this.selectedPriority,
      }),
      'Dispute status updated.',
      (updated) => {
        this.adminStatusReason = '';
        this.closeAdminActionModal();
        this.dispute.set(updated);
      },
    );
  }

  proposeResolution(): void {
    const dispute = this.dispute();
    if (!dispute || !this.resolutionDescription.trim() || !this.resolutionNotes.trim()) {
      this.error.set('Describe the proposed resolution and include supporting notes.');
      return;
    }
    if (
      ['partial_refund', 'full_refund'].includes(this.resolutionType) &&
      (this.resolutionAmount === null || this.resolutionAmount < 0)
    ) {
      this.error.set('Enter the proposed refund amount.');
      return;
    }
    this.run(
      this.disputes.proposeResolution(this.writableRole, dispute._id, {
        type: this.resolutionType,
        description: this.resolutionDescription.trim(),
        amount: this.resolutionAmount ?? undefined,
        responsibleParty: this.resolutionResponsibleParty,
        notes: this.resolutionNotes.trim(),
        documents: this.conversationAttachments,
      }),
      'Resolution proposal submitted.',
      (updated) => {
        this.conversationAttachments = [];
        this.resolutionDescription = '';
        this.resolutionNotes = '';
        this.dispute.set(updated);
      },
    );
  }

  decideResolution(decision: 'accept' | 'reject'): void {
    const dispute = this.dispute();
    if (!dispute) return;
    if (decision === 'reject' && !this.resolutionDecisionReason.trim()) {
      this.error.set('Explain why you are rejecting the proposed resolution.');
      return;
    }
    this.run(
      this.disputes.decideResolution(this.writableRole, dispute._id, {
        decision,
        reason: this.resolutionDecisionReason.trim() || undefined,
      }),
      decision === 'accept' ? 'Resolution accepted.' : 'Resolution rejected.',
      (updated) => {
        this.resolutionDecisionReason = '';
        this.dispute.set(updated);
      },
    );
  }

  completeAdminResolution(): void {
    const dispute = this.dispute();
    if (!dispute || !this.resolutionCompletionNotes.trim()) {
      this.error.set('Add resolution completion notes.');
      return;
    }
    this.run(
      this.disputes.resolveDispute('admin', dispute._id, {
        completionNotes: this.resolutionCompletionNotes.trim(),
        refundTransactionId: this.refundTransactionId.trim() || undefined,
        requiredActionCompleted: this.requiredActionCompleted,
        documents: this.completionDocuments,
      }),
      'Dispute marked resolved.',
      (updated) => {
        this.resolutionCompletionNotes = '';
        this.refundTransactionId = '';
        this.requiredActionCompleted = false;
        this.completionDocuments = [];
        this.closeAdminActionModal();
        this.dispute.set(updated);
      },
    );
  }

  closeAsAdmin(): void {
    const dispute = this.dispute();
    if (!dispute || !this.closeReason.trim()) {
      this.error.set('Enter a final closure note.');
      return;
    }
    this.closeDisputeModalOpen.set(false);
    this.confirmationAction = 'closeAdminDispute';
    this.confirmation.set({
      title: 'Close dispute?',
      message: 'This will close the case and prevent further messages. Continue?',
      confirmLabel: 'Close dispute',
      cancelLabel: 'Cancel',
      destructive: true,
    });
  }

  acceptDispute(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.accept(dispute._id), 'Dispute accepted.', (updated) =>
      this.dispute.set(updated),
    );
  }

  rejectDispute(): void {
    const dispute = this.dispute();
    if (!dispute || !this.rejectionReason.trim() || !this.rejectionExplanation.trim()) {
      this.error.set('Provide a rejection reason and explanation.');
      return;
    }

    this.run(
      this.disputes.reject(dispute._id, {
        reason: this.rejectionReason.trim(),
        explanation: this.rejectionExplanation.trim(),
        attachments: this.conversationAttachments,
      }),
      'Dispute response sent to the customer.',
      (updated) => {
        this.rejectionReason = '';
        this.rejectionExplanation = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  submitShopResponse(): void {
    const dispute = this.dispute();
    if (
      !dispute ||
      !this.shopResponseExplanation.trim() ||
      !this.shopResponseMessage.trim()
    ) {
      this.error.set('Provide an explanation and message for the customer.');
      return;
    }
    this.run(
      this.disputes.respondAsShop(dispute._id, {
        explanation: this.shopResponseExplanation.trim(),
        message: this.shopResponseMessage.trim(),
        proposedResolution: this.shopProposedResolution.trim() || undefined,
        attachments: this.conversationAttachments,
      }),
      'Response sent to the customer.',
      (updated) => {
        this.shopResponseExplanation = '';
        this.shopResponseMessage = '';
        this.shopProposedResolution = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  startReinspection(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.startReinspection(dispute._id), 'Reinspection started.', (updated) =>
      this.dispute.set(updated),
    );
  }

  submitReinspection(): void {
    const dispute = this.dispute();
    if (
      !dispute ||
      !this.reinspectionFindings.trim() ||
      !this.requiredRepairWork.trim()
    ) {
      this.error.set('Complete the inspection findings and required repair work.');
      return;
    }
    this.run(
      this.disputes.submitReinspection(dispute._id, {
        findings: this.reinspectionFindings.trim(),
        requiredRepairWork: this.requiredRepairWork.trim(),
        estimatedCompletionTime: this.estimatedCompletionTime.trim() || undefined,
        attachments: this.conversationAttachments,
      }),
      'Reinspection findings submitted.',
      (updated) => {
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  addChargeLine(): void {
    if (this.chargeItems.length < 20) {
      this.chargeItems.push({ description: '', amount: null });
    }
  }

  removeChargeLine(index: number): void {
    if (this.chargeItems.length > 1) {
      this.chargeItems = this.chargeItems.filter((_, itemIndex) => itemIndex !== index);
    }
  }

  requestCharges(): void {
    const dispute = this.dispute();
    const items = this.chargeItems.map((item) => ({
      description: item.description.trim(),
      amount: item.amount,
    }));
    if (
      !dispute ||
      !this.chargeReason.trim() ||
      items.some((item) => !item.description || item.amount === null || item.amount < 0)
    ) {
      this.error.set('Enter a reason and a description and amount for each charge item.');
      return;
    }
    this.run(
      this.disputes.requestAdditionalCharges(dispute._id, {
        reason: this.chargeReason.trim(),
        items: items.map((item) => ({
          description: item.description,
          amount: item.amount as number,
        })),
        message: this.chargeMessage.trim() || undefined,
      }),
      'Additional charges sent to the customer for approval.',
      (updated) => this.dispute.set(updated),
    );
  }

  decideCharges(chargeId: string, decision: 'accept' | 'decline'): void {
    const dispute = this.dispute();
    if (!dispute) return;
    if (!chargeId || chargeId === 'undefined') {
      this.error.set(
        'This charge request is missing its reference. Refresh the dispute and try again.',
      );
      return;
    }
    this.run(
      this.disputes.decideAdditionalCharges(
        dispute._id,
        chargeId,
        decision,
        decision === 'decline' ? this.message.trim() : undefined,
      ),
      decision === 'accept' ? 'Additional charges approved.' : 'Additional charges declined.',
      (updated) => {
        this.message = '';
        this.dispute.set(updated);
      },
    );
  }

  startRework(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.startRework(dispute._id), 'Rework started.', (updated) =>
      this.dispute.set(updated),
    );
  }

  addReworkProgress(): void {
    const dispute = this.dispute();
    if (!dispute || !this.progressNotes.trim()) {
      this.error.set('Enter a progress update.');
      return;
    }
    this.run(
      this.disputes.addProgress(dispute._id, {
        notes: this.progressNotes.trim(),
        attachments: this.conversationAttachments,
      }),
      'Progress update added.',
      (updated) => {
        this.progressNotes = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  completeRework(): void {
    const dispute = this.dispute();
    if (!dispute || !this.reworkDescription.trim() || !this.testingResults.trim()) {
      this.error.set('Enter the work performed and device testing results.');
      return;
    }
    if (!this.reworkTested) {
      this.error.set('Confirm that the device has been tested before completion.');
      return;
    }
    this.run(
      this.disputes.completeRework(dispute._id, {
        workPerformed: this.reworkDescription.trim(),
        partsReplaced: this.partsReplaced.trim() || undefined,
        testingResults: this.testingResults.trim(),
        finalNotes: this.finalNotes.trim() || undefined,
        tested: this.reworkTested,
        attachments: this.completionDocuments,
      }),
      'Rework marked complete. The customer has been asked to verify the repair.',
      (updated) => this.dispute.set(updated),
    );
  }

  confirmResolution(): void {
    const dispute = this.dispute();
    if (!dispute || !this.verificationNotes.trim()) {
      this.error.set('Confirm the repair and add a short note before continuing.');
      return;
    }
    this.confirmationAction = 'confirmResolution';
    this.confirmation.set({
      title: 'Confirm repair resolution?',
      message: 'Confirm that the repaired device is working and the issue is resolved?',
      confirmLabel: 'Confirm resolution',
      cancelLabel: 'Cancel',
    });
  }

  closeConfirmation(): void {
    this.confirmationAction = null;
    this.confirmation.set(null);
  }

  confirmPendingAction(): void {
    const action = this.confirmationAction;
    this.closeConfirmation();
    if (action === 'confirmResolution') {
      this.submitResolutionConfirmation();
    } else if (action === 'closeAdminDispute') {
      this.submitAdminDisputeClosure();
    }
  }

  private submitAdminDisputeClosure(): void {
    const dispute = this.dispute();
    if (!dispute || !this.closeReason.trim()) return;
    this.run(
      this.disputes.closeAsAdmin(dispute._id, this.closeReason.trim()),
      'Dispute closed.',
      (updated) => {
        this.closeReason = '';
        this.closeDisputeModalOpen.set(false);
        this.dispute.set(updated);
      },
    );
  }

  private submitResolutionConfirmation(): void {
    const dispute = this.dispute();
    if (!dispute || !this.verificationNotes.trim()) return;
    this.run(
      this.disputes.confirmResolution(dispute._id, { message: this.verificationNotes.trim() }),
      'Thank you. This dispute is now resolved.',
      (updated) => this.dispute.set(updated),
    );
  }

  reportUnresolved(): void {
    const dispute = this.dispute();
    if (!dispute || !this.unresolvedNotes.trim()) {
      this.error.set('Describe what is still not working.');
      return;
    }
    this.run(
      this.disputes.reportUnresolved(dispute._id, {
        notes: this.unresolvedNotes.trim(),
        attachments: this.conversationAttachments,
      }),
      'The shop has been notified that the issue remains.',
      (updated) => {
        this.unresolvedNotes = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    await this.addDisputeAttachments(files);
    input.value = '';
  }

  async onFilesDropped(event: DragEvent): Promise<void> {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    await this.addDisputeAttachments(files);
  }

  private async addDisputeAttachments(files: File[]): Promise<void> {
    if (!files.length) return;
    if (files.length + this.attachments.length > 2) {
      this.setRaiseDisputeError('Attach up to two files, each no larger than 500 KB.');
      return;
    }
    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.attachments = [...this.attachments, ...attachments];
      this.setRaiseDisputeError('');
    } catch (error) {
      this.setRaiseDisputeError(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    }
  }

  async onCompletionFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    if (files.length + this.completionDocuments.length > 2) {
      this.error.set('Attach up to two completion evidence files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const documents = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.completionDocuments = [...this.completionDocuments, ...documents];
      this.error.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  async onConversationFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    if (files.length + this.conversationAttachments.length > 2) {
      this.error.set('Attach up to two message files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.conversationAttachments = [...this.conversationAttachments, ...attachments];
      this.error.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  removeAttachment(index: number): void {
    this.attachments = this.attachments.filter((_, itemIndex) => itemIndex !== index);
  }

  removeCompletionDocument(index: number): void {
    this.completionDocuments = this.completionDocuments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeConversationAttachment(index: number): void {
    this.conversationAttachments = this.conversationAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  attachmentUrl(attachment: DisputeAttachment): string {
    if (attachment.data) {
      return `data:${attachment.mimeType};base64,${attachment.data}`;
    }
    const dispute = this.dispute();
    if (!attachment.fileId || !dispute) return '';
    return `${environment.apiBaseUrl}/${this.role()}/disputes/${encodeURIComponent(dispute._id)}/attachments/${encodeURIComponent(attachment.fileId)}`;
  }

  repairStatus(repair: NonNullable<RepairDispute['repair']>): string {
    return String(repair.repairJob?.['status'] || repair.status);
  }

  customerCoordinates(): { latitude: number; longitude: number } | null {
    const location = this.mapLocations()?.location;
    return this.isValidCoordinates(location) ? location : null;
  }

  shopCoordinates(): { latitude: number; longitude: number } | null {
    const location = this.mapLocations()?.shopLocation;
    return this.isValidCoordinates(location) ? location : null;
  }

  hasRouteCoordinates(): boolean {
    return !!this.customerCoordinates() && !!this.shopCoordinates();
  }

  adminCustomerName(repair: AdminRepairJob): string {
    return (
      repair.customer.displayName ||
      [repair.customer.firstName, repair.customer.lastName].filter(Boolean).join(' ') ||
      'Customer'
    );
  }

  adminCustomerInitials(repair: AdminRepairJob): string {
    const name = this.adminCustomerName(repair);
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  adminCustomerPhone(repair: AdminRepairJob): string {
    return (
      [repair.customer.countryCode, repair.customer.mobileNumber].filter(Boolean).join(' ') ||
      'Not provided'
    );
  }

  adminShopPhone(repair: AdminRepairJob): string {
    return (
      [repair.shop?.countryCode, repair.shop?.mobileNumber].filter(Boolean).join(' ') ||
      'Not provided'
    );
  }

  adminShopLocation(repair: AdminRepairJob): string {
    const address = repair.shop?.address?.trim() || '';
    const addressLower = address.toLowerCase();
    const remainingParts = [
      repair.shop?.city,
      repair.shop?.state,
      repair.shop?.postalCode,
    ].filter((part): part is string => {
      const value = part?.trim();
      if (!value) return false;
      return !addressLower.includes(value.toLowerCase());
    });
    return [address, ...remainingParts].filter(Boolean).join(', ');
  }

  customerLocationLabel(): string {
    const location = this.customerCoordinates();
    return location
      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
      : 'Not provided';
  }

  repairDocuments(
    repair: AdminRepairJob,
  ): Array<{ mimeType: string; data: string; label: string }> {
    return [
      ...(repair.photos ?? []).map((document, index) => ({
        ...document,
        label: `Repair request photo ${index + 1}`,
      })),
      ...(repair.repairJob.inspection?.images ?? []).map((document, index) => ({
        ...document,
        label: `Inspection photo ${index + 1}`,
      })),
    ];
  }

  private isValidCoordinates(
    location:
      | { latitude: number; longitude: number }
      | null
      | undefined,
  ): location is { latitude: number; longitude: number } {
    return (
      !!location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private loadMapLocations(requestId: string): void {
    this.mapLoading.set(true);
    this.adminService.getMapRequest(requestId).subscribe({
      next: (locations) => {
        this.mapLocations.set(locations);
        this.mapLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.mapError.set(
          error.error?.message || 'Repair location details could not be loaded.',
        );
        this.mapLoading.set(false);
      },
    });
  }

  private loadAdminRepairDetails(requestId: string): void {
    this.adminRepairDetailsLoading.set(true);
    this.adminRepairDetailsError.set('');
    this.adminService.getRepairJobDetails(requestId).subscribe({
      next: (repair) => {
        this.adminRepairDetails.set(repair);
        this.adminRepairDetailsLoading.set(false);
        if (!repair) {
          this.adminRepairDetailsError.set('The linked repair details could not be found.');
          return;
        }
        this.adminCustomerImageUnavailable.set(false);
        this.adminShopImageUnavailable.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.adminRepairDetailsLoading.set(false);
        this.adminRepairDetailsError.set(
          error.error?.message || 'The linked repair details could not be loaded.',
        );
      },
    });
  }

  repairPhotoSource(photo: { mimeType: string; data: string }): string {
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

  repairWork(repair: NonNullable<RepairDispute['repair']>): string {
    const job = repair.repairJob;
    const work = job?.['workPerformed'] || job?.['completionDescription'];
    return String(work || repair.quotation?.proposedSolution || repair.quotation?.message || repair.description);
  }

  repairCompletedAt(repair: NonNullable<RepairDispute['repair']>): string | Date | null {
    const job = repair.repairJob;
    const repairedAt = job?.['completedAt'] || job?.['repairCompletedAt'] || job?.['pickedUpAt'];
    return typeof repairedAt === 'string' || repairedAt instanceof Date ? repairedAt : null;
  }

  disputeProgressStep(item: RepairDispute): number {
    if (
      item.resolution.state === 'final' ||
      DISPUTE_COMPLETE_PROGRESS_STATUSES.includes(item.status)
    ) {
      return 4;
    }
    if (
      item.resolution.state === 'proposed' ||
      DISPUTE_RESOLUTION_PROGRESS_STATUSES.includes(item.status)
    ) {
      return 3;
    }
    return item.status === 'OPEN' ? 1 : 2;
  }

  isDisputeComplete(item: RepairDispute): boolean {
    return (
      item.resolution.state === 'final' ||
      DISPUTE_COMPLETE_PROGRESS_STATUSES.includes(item.status)
    );
  }

  disputeProgressDate(item: RepairDispute, stepIndex: number): string | undefined {
    if (stepIndex === 0) return item.createdAt;
    if (stepIndex === 2 && item.resolution.proposedAt) {
      return item.resolution.proposedAt;
    }
    if (stepIndex === 3 && (item.resolution.resolvedAt || item.resolution.closedAt)) {
      return item.resolution.resolvedAt || item.resolution.closedAt;
    }
    const statuses =
      stepIndex === 1
        ? DISPUTE_REVIEW_PROGRESS_STATUSES
        : stepIndex === 2
          ? DISPUTE_RESOLUTION_PROGRESS_STATUSES
          : DISPUTE_COMPLETE_PROGRESS_STATUSES;
    return item.statusHistory.find((entry) => statuses.includes(entry.to))?.at;
  }

  get isRepairEligible(): boolean {
    return ['picked_up', 'completed'].includes(this.repairSummary()?.status ?? '');
  }

  get categoryFilter(): DisputeCategory | '' {
    return this.selectedCategory;
  }
  set categoryFilter(value: DisputeCategory | '') {
    this.selectedCategory = value;
  }

  private selectedCategory: DisputeCategory | '' = '';

  get canSendMessage(): boolean {
    const status = this.dispute()?.status;
    return (
      this.role() !== 'technician' && status !== 'CLOSED' && status !== 'RESOLVED'
    );
  }

  private get writableRole(): DisputeRole {
    return this.role() as DisputeRole;
  }

  get latestCharge() {
    return this.dispute()?.additionalCharges?.at(-1);
  }

  get latestReinspection() {
    return this.dispute()?.reinspections?.at(-1);
  }

  get latestCompletion() {
    return this.dispute()?.reworkCompletions?.at(-1);
  }

  hasCompletedRework(dispute: RepairDispute): boolean {
    return (
      Array.isArray(dispute.reworkCompletions) &&
      dispute.reworkCompletions.length > 0
    );
  }

  get latestVerification() {
    return this.dispute()?.verificationHistory?.at(-1);
  }

  private readAttachment(file: File): Promise<DisputeAttachment> {
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
    if (!acceptedTypes.includes(file.type as (typeof acceptedTypes)[number])) {
      return Promise.reject(new Error('Evidence must be a JPEG, PNG, WebP image, or PDF.'));
    }
    if (file.size > 500 * 1024) {
      return Promise.reject(new Error(`${file.name} exceeds the 500 KB limit.`));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error(`${file.name} could not be read.`));
          return;
        }
        resolve({
          name: file.name,
          mimeType: file.type as DisputeAttachment['mimeType'],
          data: reader.result,
        });
      };
      reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
      reader.readAsDataURL(file);
    });
  }

  private run(
    request: import('rxjs').Observable<RepairDispute>,
    successMessage: string,
    onSuccess: (dispute: RepairDispute) => void,
    errorTarget: WritableSignal<string> = this.error,
  ): void {
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    request.subscribe({
      next: (dispute) => {
        this.saving.set(false);
        this.toastService.success('Dispute Center', successMessage);
        onSuccess(dispute);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(
          error,
          'The requested dispute action could not be completed.',
          errorTarget,
        ),
    });
  }

  private fail(
    error: HttpErrorResponse,
    fallback: string,
    errorTarget: WritableSignal<string> = this.error,
  ): void {
    const msg = error.error?.message || fallback;
    errorTarget.set(msg);
    this.toastService.error('Dispute Error', msg);
    this.loading.set(false);
    this.saving.set(false);
  }
}
