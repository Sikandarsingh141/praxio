import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe, DatePipe, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import {
  ConfirmationDialogConfig,
  ConfirmationDialogComponent,
} from '../shared/confirmation-dialog.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';
import { PaginationComponent } from '../shared/pagination.component';
import { AdminPageHeaderComponent } from './admin-page-header.component';
import {
  AdminRegistrationRequest,
  AdminService,
  AdminUserStatistics,
  RegistrationRequestPage,
} from './admin.service';

type RequestStatus = 'all' | 'pending' | 'approved' | 'declined' | 'suspended';
type AccountStatus = 'all' | 'active' | 'inactive' | 'suspended';
type UserAdminAction = 'approve' | 'decline' | 'activate' | 'deactivate' | 'suspend';
type RegistrationDecision = 'approve' | 'decline';

interface RegistrationConfirmation {
  request: AdminRegistrationRequest;
  action: UserAdminAction;
  dialog: ConfirmationDialogConfig;
}

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    TitleCasePipe,
    UpperCasePipe,
    ConfirmationDialogComponent,
    CommonFilterComponent,
    PaginationComponent,
  ],
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly searchChanges = new Subject<string>();
  readonly requests = signal<AdminRegistrationRequest[]>([]);
  readonly statistics = signal<AdminUserStatistics | null>(null);
  readonly statisticsLoading = signal(true);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly noticeMessage = signal('');
  readonly activeAction = signal<string | null>(null);
  readonly statusFilter = signal<RequestStatus>('all');
  readonly accountTypeFilter = signal<'all' | 'customer' | 'shop'>('all');
  readonly accountStatusFilter = signal<AccountStatus>('all');
  readonly searchText = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly sortBy = signal<'name' | 'registrationDate' | 'status'>('registrationDate');
  readonly sortOrder = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly pageSize = signal(5);
  readonly confirmation = signal<RegistrationConfirmation | null>(null);
  readonly appliedFilters = signal<FilterValues>({});
  readonly pageTitle = () =>
    this.accountTypeFilter() === 'shop'
      ? 'Shops'
      : this.accountTypeFilter() === 'customer'
        ? 'Customers'
        : 'User management';
  readonly pageDescription = () =>
    this.accountTypeFilter() === 'shop'
      ? 'Review repair shop registrations and manage shop account access.'
      : this.accountTypeFilter() === 'customer'
        ? 'Review customer registrations and manage customer account access.'
        : 'Search customer and repair shop accounts, review registrations, and manage account access.';
  readonly filterConfig: FilterConfig = {
    title: 'User filters',
    fields: [
      {
        key: 'accountType',
        label: 'User type',
        type: 'select',
        placeholder: 'All user types',
        options: [
          { label: 'Customer', value: 'customer' },
          { label: 'Repair shop', value: 'shop' },
        ],
      },
      {
        key: 'approvalStatus',
        label: 'Approval status',
        type: 'select',
        placeholder: 'All approval statuses',
        options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Declined', value: 'declined' },
        ],
      },
      {
        key: 'accountStatus',
        label: 'Account status',
        type: 'select',
        placeholder: 'All account statuses',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Suspended', value: 'suspended' },
        ],
      },
      { key: 'registrationDate', label: 'Registration date', type: 'date-range' },
    ],
  };

  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.searchText.set(value);
        this.page.set(1);
        this.loadRequests();
      });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const accountType = params.get('accountType');
      this.searchText.set(params.get('search')?.trim() ?? '');
      this.accountTypeFilter.set(
        accountType === 'customer' || accountType === 'shop' ? accountType : 'all',
      );
      this.appliedFilters.set(
        accountType === 'customer' || accountType === 'shop' ? { accountType } : {},
      );
      this.page.set(1);
      this.loadRequests();
    });
    this.loadStatistics();
  }

  updateSearch(value: string): void {
    this.searchChanges.next(value.trim());
  }

  setStatisticsFilter(filter: 'all' | 'customer' | 'shop' | 'pending' | AccountStatus): void {
    this.accountTypeFilter.set(filter === 'customer' || filter === 'shop' ? filter : 'all');
    this.statusFilter.set(
      filter === 'pending' ? 'pending' : filter === 'suspended' ? 'suspended' : 'all',
    );
    this.accountStatusFilter.set(
      filter === 'active' || filter === 'inactive' || filter === 'suspended' ? filter : 'all',
    );
    this.appliedFilters.set(
      filter === 'customer' || filter === 'shop'
        ? { accountType: filter }
        : filter === 'pending'
          ? { approvalStatus: 'pending' }
          : filter === 'active' || filter === 'inactive' || filter === 'suspended'
            ? { accountStatus: filter }
            : {},
    );
    this.page.set(1);
    this.loadRequests();
  }

  setStatusFilter(status: RequestStatus): void {
    this.statusFilter.set(status);
    this.accountStatusFilter.set(status === 'suspended' ? 'suspended' : 'all');
    this.appliedFilters.update((filters) => ({
      ...filters,
      approvalStatus:
        status === 'pending' || status === 'approved' || status === 'declined' ? status : undefined,
      accountStatus: status === 'suspended' ? 'suspended' : undefined,
    }));
    this.removeEmptyFilters();
    this.page.set(1);
    this.loadRequests();
  }

  setAccountTypeFilter(accountType: 'all' | 'customer' | 'shop'): void {
    this.accountTypeFilter.set(accountType);
    this.appliedFilters.update((filters) => ({
      ...filters,
      accountType: accountType === 'all' ? undefined : accountType,
    }));
    this.removeEmptyFilters();
    this.page.set(1);
    this.loadRequests();
  }

  setAccountStatusFilter(status: AccountStatus): void {
    this.accountStatusFilter.set(status);
    this.statusFilter.set('all');
    this.appliedFilters.update((filters) => ({
      ...filters,
      accountStatus: status === 'all' ? undefined : status,
      approvalStatus: undefined,
    }));
    this.removeEmptyFilters();
    this.page.set(1);
    this.loadRequests();
  }

  applyFilters(filters: FilterValues): void {
    const current = this.appliedFilters();
    if (JSON.stringify(current) === JSON.stringify(filters)) return;
    this.appliedFilters.set(filters);
    const accountType = filters['accountType'];
    const approvalStatus = filters['approvalStatus'];
    const accountStatus = filters['accountStatus'];
    const registrationDate = filters['registrationDate'];
    this.accountTypeFilter.set(
      accountType === 'customer' || accountType === 'shop' ? accountType : 'all',
    );
    this.statusFilter.set(
      approvalStatus === 'pending' || approvalStatus === 'approved' || approvalStatus === 'declined'
        ? approvalStatus
        : accountStatus === 'suspended'
          ? 'suspended'
          : 'all',
    );
    this.accountStatusFilter.set(
      accountStatus === 'active' || accountStatus === 'inactive' || accountStatus === 'suspended'
        ? accountStatus
        : 'all',
    );
    this.fromDate.set(
      registrationDate && typeof registrationDate === 'object' && 'from' in registrationDate
        ? (registrationDate.from ?? '')
        : '',
    );
    this.toDate.set(
      registrationDate && typeof registrationDate === 'object' && 'to' in registrationDate
        ? (registrationDate.to ?? '')
        : '',
    );
    this.page.set(1);
    this.loadRequests();
  }

  private removeEmptyFilters(): void {
    this.appliedFilters.set(
      Object.fromEntries(
        Object.entries(this.appliedFilters()).filter(([, value]) => value !== undefined),
      ),
    );
  }

  updateSort(event: Event): void {
    const target = event.target;
    if (
      target instanceof HTMLSelectElement &&
      ['name', 'registrationDate', 'status'].includes(target.value)
    ) {
      this.sortBy.set(target.value as 'name' | 'registrationDate' | 'status');
      this.page.set(1);
      this.loadRequests();
    }
  }

  toggleSortOrder(): void {
    this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    this.loadRequests();
  }

  search(value: string): void {
    this.searchChanges.next(value.trim());
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.loadRequests();
  }

  approve(request: AdminRegistrationRequest): void {
    if (this.activeAction() || request.registrationStatus !== 'pending') {
      return;
    }

    const applicant = request.applicantName || request.email;
    this.confirmation.set({
      request,
      action: 'approve',
      dialog: {
        title: 'Approve registration?',
        message: `Approve ${applicant}'s registration?`,
        confirmLabel: 'Approve',
        cancelLabel: 'Cancel',
      },
    });
  }

  beginDecline(request: AdminRegistrationRequest): void {
    if (this.activeAction() || request.registrationStatus !== 'pending') {
      return;
    }

    const applicant = request.applicantName || request.email;
    this.confirmation.set({
      request,
      action: 'decline',
      dialog: {
        title: 'Decline registration?',
        message: `Decline ${applicant}'s registration? Provide a reason to continue.`,
        confirmLabel: 'Decline',
        cancelLabel: 'Cancel',
        destructive: true,
        reasonLabel: 'Decline reason',
        reasonPlaceholder: 'Explain why this registration is being declined',
        reasonRequired: true,
      },
    });
  }

  beginAccountAction(
    request: AdminRegistrationRequest,
    action: 'activate' | 'deactivate' | 'suspend',
  ): void {
    if (this.activeAction() || request.registrationStatus !== 'approved') {
      return;
    }
    const labels = {
      activate: { title: 'Reactivate account?', label: 'Reactivate' },
      deactivate: { title: 'Deactivate account?', label: 'Deactivate' },
      suspend: { title: 'Suspend account?', label: 'Suspend' },
    } as const;
    const config = labels[action];
    this.confirmation.set({
      request,
      action,
      dialog: {
        title: config.title,
        message: `${config.label} ${request.applicantName || request.email}'s account?`,
        confirmLabel: config.label,
        cancelLabel: 'Cancel',
        destructive: action !== 'activate',
        ...(action === 'suspend'
          ? {
              reasonLabel: 'Suspension reason',
              reasonPlaceholder: 'Explain why this account is being suspended',
              reasonRequired: true,
            }
          : {}),
      },
    });
  }

  cancelConfirmation(): void {
    this.confirmation.set(null);
  }

  confirmDecision(reason: string): void {
    const confirmation = this.confirmation();
    if (
      !confirmation ||
      this.activeAction() ||
      (confirmation.action === 'approve' &&
        confirmation.request.registrationStatus !== 'pending') ||
      (confirmation.action === 'decline' &&
        confirmation.request.registrationStatus !== 'pending') ||
      (confirmation.action !== 'approve' &&
        confirmation.action !== 'decline' &&
        confirmation.request.registrationStatus !== 'approved')
    ) {
      return;
    }
    if (
      (confirmation.action === 'decline' || confirmation.action === 'suspend') &&
      !reason.trim()
    ) {
      this.errorMessage.set('Enter a decline reason before continuing.');
      return;
    }

    this.confirmation.set(null);
    if (!['approve', 'decline'].includes(confirmation.action)) {
      const status =
        confirmation.action === 'activate'
          ? 'active'
          : confirmation.action === 'deactivate'
            ? 'inactive'
            : 'suspended';
      this.runAccountStatusUpdate(confirmation.request, status, reason.trim() || undefined);
      return;
    }
    this.runDecision(
      confirmation.request,
      confirmation.action as 'approve' | 'decline',
      confirmation.action === 'decline' ? reason.trim() : undefined,
    );
  }

  private loadRequests(clearError = true): void {
    this.loading.set(true);
    if (clearError) {
      this.errorMessage.set('');
    }
    this.adminService
      .getRegistrationRequests({
        page: this.page(),
        limit: this.pageSize(),
        status: this.statusFilter() === 'suspended' ? 'all' : this.statusFilter(),
        accountType: this.accountTypeFilter() === 'all' ? undefined : this.accountTypeFilter(),
        accountStatus: this.accountStatusFilter(),
        search: this.searchText(),
        fromDate: this.fromDate(),
        toDate: this.toDate(),
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result: RegistrationRequestPage) => {
          this.requests.set(result.requests);
          this.total.set(result.total);
          this.totalPages.set(result.totalPages);
          this.page.set(result.page);
        },
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to load registration requests.'),
          ),
      });
  }

  private loadStatistics(): void {
    this.statisticsLoading.set(true);
    this.adminService
      .getUserStatistics()
      .pipe(finalize(() => this.statisticsLoading.set(false)))
      .subscribe({
        next: (statistics) => this.statistics.set(statistics),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to load user summary statistics.'),
          ),
      });
  }

  private runDecision(
    request: AdminRegistrationRequest,
    action: RegistrationDecision,
    reason?: string,
  ): void {
    this.errorMessage.set('');
    this.noticeMessage.set('');
    this.activeAction.set(`${request.id}:${action}`);
    const request$ = request.registrationRequestId
      ? action === 'approve'
        ? this.adminService.approveRegistration(request.registrationRequestId)
        : this.adminService.declineRegistration(request.registrationRequestId, reason ?? '')
      : request.accountType === 'shop'
        ? action === 'approve'
          ? this.adminService.approveExistingShop(request.userId)
          : this.adminService.declineExistingShop(request.userId, reason ?? '')
        : null;

    if (!request$) {
      this.activeAction.set(null);
      this.errorMessage.set('This pending account has no review request. Please contact support.');
      return;
    }

    request$.pipe(finalize(() => this.activeAction.set(null))).subscribe({
      next: () => {
        this.noticeMessage.set(
          action === 'approve'
            ? `${request.applicantName || request.email} approved. They can now sign in.`
            : `${request.applicantName || request.email} declined.`,
        );
        this.loadRequests();
        this.loadStatistics();
      },
      error: (error: unknown) =>
        this.errorMessage.set(getAuthErrorMessage(error, 'Unable to update this registration.')),
    });
  }

  private runAccountStatusUpdate(
    request: AdminRegistrationRequest,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string,
  ): void {
    this.errorMessage.set('');
    this.noticeMessage.set('');
    this.activeAction.set(`${request.id}:${status}`);
    this.adminService
      .updateUserStatus(request.userId, status, reason)
      .pipe(finalize(() => this.activeAction.set(null)))
      .subscribe({
        next: () => {
          this.noticeMessage.set(
            `${request.applicantName || request.email}'s account is now ${status}.`,
          );
          this.loadRequests();
          this.loadStatistics();
        },
        error: (error: unknown) => {
          const message = getAuthErrorMessage(error, 'Unable to update account status.');
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.loadRequests(false);
            this.loadStatistics();
          }
          this.errorMessage.set(message);
        },
      });
  }
}
