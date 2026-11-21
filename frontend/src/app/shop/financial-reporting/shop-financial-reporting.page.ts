import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, finalize, expand, reduce } from 'rxjs';
import { getAuthErrorMessage } from '../../core/auth/auth-error-message';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../shared/components/job-pagination/job-pagination.component';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { TableScrollIndicatorsDirective } from '../../shared/directives/table-scroll-indicators.directive';
import {
  RepairInvoice,
  RepairInvoiceListFilters,
  RepairInvoicePaymentMethod,
  RepairInvoicePaymentStatus,
  ShopFinancialReport,
  ShopFinancialTransaction,
  ShopFinancialTransactionsFilters,
} from '../../shared/models/repair-invoice.models';
import { RepairInvoicesService } from '../../shared/services/repair-invoices.service';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';

type FinancialReportTab =
  | 'overview'
  | 'revenue'
  | 'transactions'
  | 'invoices'
  | 'payments'
  | 'outstanding'
  | 'refunds'
  | 'tax'
  | 'analytics';

type TrendInterval = 'daily' | 'weekly' | 'monthly';
type QuickReportType = 'revenue' | 'invoices' | 'payments' | 'outstanding' | 'tax';

interface FinancialChartPoint {
  key: string;
  label: string;
  amount: number;
  x: number;
  y: number;
}

interface FinancialDonutSegment {
  key: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
  dasharray: string;
  dashoffset: string;
}

@Component({
  selector: 'app-shop-financial-reporting-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CommonFilterComponent,
    JobPaginationComponent,
    AdminPageHeaderComponent,
    TableScrollIndicatorsDirective,
  ],
  templateUrl: './shop-financial-reporting.page.html',
  styleUrl: './shop-financial-reporting.page.scss',
})
export class ShopFinancialReportingPage {
  private readonly invoicesService = inject(RepairInvoicesService);

  readonly tabs: Array<{ id: FinancialReportTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue Reports' },
    { id: 'transactions', label: 'Repair Transactions' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payments', label: 'Payment Reports' },
    { id: 'outstanding', label: 'Outstanding Payments' },
    { id: 'refunds', label: 'Refunds' },
    { id: 'tax', label: 'Tax Reports' },
    { id: 'analytics', label: 'Analytics' },
  ];

  readonly activeTab = signal<FinancialReportTab>('overview');
  readonly from = signal('');
  readonly to = signal('');
  readonly appliedFilters = signal<FilterValues>({});
  readonly report = signal<ShopFinancialReport | null>(null);
  readonly trendInterval = signal<TrendInterval>('monthly');
  readonly selectedChartCurrency = signal('');
  readonly selectedPaymentCurrency = signal('');
  readonly quickReports: Array<{
    id: QuickReportType;
    title: string;
    description: string;
  }> = [
    { id: 'revenue', title: 'Revenue summary', description: 'Invoice revenue by currency' },
    { id: 'invoices', title: 'Invoice report', description: 'Issued and draft invoices' },
    { id: 'payments', title: 'Payment report', description: 'Successful payment records' },
    { id: 'outstanding', title: 'Outstanding balances', description: 'Invoices with amounts due' },
    { id: 'tax', title: 'Recorded tax', description: 'Tax saved on invoice snapshots' },
  ];
  readonly reportLoading = signal(false);
  readonly reportError = signal('');
  readonly exportLoading = signal(false);
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly transactions = signal<ShopFinancialTransaction[]>([]);
  readonly invoices = signal<RepairInvoice[]>([]);
  readonly unavailableCustomerImages = signal(new Set<string>());
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly totalRows = signal(0);
  readonly search = signal('');
  readonly paymentMethod = signal<RepairInvoicePaymentMethod | ''>('');
  readonly paymentStatus = signal<ShopFinancialTransaction['status'] | ''>('');
  readonly invoicePaymentStatus = signal<RepairInvoicePaymentStatus | ''>('');
  readonly downloadingInvoiceId = signal('');

  constructor() {
    this.loadReport();
  }

  get filterConfig(): FilterConfig {
    const fields: FilterConfig['fields'] = [
      {
        key: 'dateRange',
        label: 'Date range',
        type: 'date-range',
        dateRangePresets: [
          { label: 'Last 30 days', value: 'last-30-days' },
          { label: 'Last 90 days', value: 'last-90-days' },
          { label: 'Year to date', value: 'year-to-date' },
        ],
      },
    ];
    const tab = this.activeTab();

    if (tab === 'transactions' || tab === 'payments') {
      fields.push(
        {
          key: 'search',
          label: 'Search',
          type: 'text',
          placeholder: 'Invoice, customer, reference',
        },
        {
          key: 'method',
          label: 'Method',
          type: 'select',
          placeholder: 'All methods',
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'UPI', value: 'upi' },
            { label: 'Bank transfer', value: 'bank_transfer' },
            { label: 'Online payment', value: 'stripe' },
          ],
        },
      );
      if (tab === 'transactions') {
        fields.push({
          key: 'status',
          label: 'Payment status',
          type: 'select',
          placeholder: 'All statuses',
          options: [
            { label: 'Succeeded', value: 'succeeded' },
            { label: 'Pending', value: 'pending' },
            { label: 'Failed', value: 'failed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        });
      }
    } else if (tab === 'invoices' || tab === 'outstanding') {
      fields.push(
        {
          key: 'search',
          label: 'Search',
          type: 'text',
          placeholder: 'Invoice or customer',
        },
        {
          key: 'invoicePaymentStatus',
          label: 'Payment status',
          type: 'select',
          placeholder: 'All statuses',
          options: [
            { label: 'Unpaid', value: 'UNPAID' },
            { label: 'Partially paid', value: 'PARTIALLY_PAID' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
      );
    }

    const titles: Partial<Record<FinancialReportTab, string>> = {
      transactions: 'Repair transaction filters',
      invoices: 'Repair invoice filters',
      payments: 'Successful payment filters',
      outstanding: 'Outstanding payment filters',
    };
    return {
      title: titles[tab] || 'Financial reporting filters',
      applyLabel:
        tab === 'overview' || tab === 'revenue' || tab === 'tax' || tab === 'analytics'
          ? 'Apply period'
          : 'Apply filters',
      fields,
    };
  }

  selectTab(tab: FinancialReportTab): void {
    this.activeTab.set(tab);
    this.listError.set('');
    this.restoreListFilters();
    if (tab === 'transactions' || tab === 'payments') {
      this.loadTransactions(1);
    } else if (tab === 'invoices' || tab === 'outstanding') {
      this.loadInvoices(1);
    }
  }

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    const dateRange = filters['dateRange'];
    const from =
      dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) && 'from' in dateRange
        ? dateRange.from
        : undefined;
    const to =
      dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) && 'to' in dateRange
        ? dateRange.to
        : undefined;
    this.from.set(typeof from === 'string' ? from : '');
    this.to.set(typeof to === 'string' ? to : '');
    this.restoreListFilters(filters);
    this.loadReport();
    if (this.activeTab() === 'transactions' || this.activeTab() === 'payments') {
      this.loadTransactions(1);
    } else if (this.activeTab() === 'invoices' || this.activeTab() === 'outstanding') {
      this.loadInvoices(1);
    }
  }

  private restoreListFilters(filters: FilterValues = this.appliedFilters()): void {
    const search = filters['search'];
    this.search.set(typeof search === 'string' ? search : '');

    const method = filters['method'];
    this.paymentMethod.set(
      method === 'cash' ||
        method === 'upi' ||
        method === 'bank_transfer' ||
        method === 'stripe'
        ? method
        : '',
    );

    const status = filters['status'];
    this.paymentStatus.set(
      status === 'succeeded' ||
        status === 'pending' ||
        status === 'failed' ||
        status === 'cancelled'
        ? status
        : '',
    );

    const invoiceStatus = filters['invoicePaymentStatus'];
    this.invoicePaymentStatus.set(
      invoiceStatus === 'UNPAID' ||
        invoiceStatus === 'PARTIALLY_PAID' ||
        invoiceStatus === 'PAID'
        ? invoiceStatus
        : '',
    );
  }

  loadReport(): void {
    this.reportLoading.set(true);
    this.reportError.set('');
    this.invoicesService
      .getShopFinancialReport(this.periodFilters())
      .pipe(finalize(() => this.reportLoading.set(false)))
      .subscribe({
        next: (report) => this.report.set(report),
        error: (error: unknown) =>
          this.reportError.set(
            getAuthErrorMessage(error, 'Financial reports could not be loaded.'),
          ),
      });
  }

  setPage(page: number): void {
    if (this.activeTab() === 'transactions' || this.activeTab() === 'payments') {
      this.loadTransactions(page);
    } else {
      this.loadInvoices(page);
    }
  }

  setPageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.setPage(1);
  }

  loadTransactions(page = this.page()): void {
    const filters = this.transactionFilters(page, this.pageSize());
    this.listLoading.set(true);
    this.listError.set('');
    this.invoicesService
      .listShopFinancialTransactions(filters)
      .pipe(finalize(() => this.listLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.transactions.set(result.transactions);
          this.page.set(result.pagination.page);
          this.totalRows.set(result.pagination.total);
        },
        error: (error: unknown) =>
          this.listError.set(
            getAuthErrorMessage(error, 'Payment transactions could not be loaded.'),
          ),
      });
  }

  loadInvoices(page = this.page()): void {
    const filters = this.invoiceFilters(page, this.pageSize());
    this.listLoading.set(true);
    this.listError.set('');
    this.invoicesService
      .listShopInvoices(filters)
      .pipe(finalize(() => this.listLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.invoices);
          this.page.set(result.page);
          this.totalRows.set(result.total);
        },
        error: (error: unknown) =>
          this.listError.set(getAuthErrorMessage(error, 'Repair invoices could not be loaded.')),
      });
  }

  taxTotals(report: ShopFinancialReport): Array<{ currency: string; amount: number }> {
    const totals = new Map<string, number>();
    for (const tax of report.taxByRate) {
      totals.set(tax._id.currency, (totals.get(tax._id.currency) ?? 0) + tax.amount);
    }
    return Array.from(totals, ([currency, amount]) => ({ currency, amount })).sort((left, right) =>
      left.currency.localeCompare(right.currency),
    );
  }

  chartCurrencies(): string[] {
    const report = this.report();
    if (!report) return [];
    return Array.from(
      new Set([
        ...report.revenueByCurrency.map((entry) => entry._id),
        ...report.revenueTrend.map((entry) => entry._id.currency),
        ...report.revenueByCategory.map((entry) => entry._id.currency),
      ]),
    ).sort();
  }

  chartCurrency(): string {
    const currencies = this.chartCurrencies();
    const selected = this.selectedChartCurrency();
    return currencies.includes(selected) ? selected : (currencies[0] ?? '');
  }

  setChartCurrency(currency: string): void {
    this.selectedChartCurrency.set(currency);
  }

  paymentCurrencies(): string[] {
    return Array.from(
      new Set((this.report()?.collectionsByMethod ?? []).map((entry) => entry._id.currency)),
    ).sort();
  }

  paymentCurrency(): string {
    const currencies = this.paymentCurrencies();
    const selected = this.selectedPaymentCurrency();
    return currencies.includes(selected) ? selected : (currencies[0] ?? '');
  }

  setPaymentCurrency(currency: string): void {
    this.selectedPaymentCurrency.set(currency);
  }

  chartPoints(): FinancialChartPoint[] {
    const report = this.report();
    const currency = this.chartCurrency();
    if (!report || !currency) return [];

    const currencyTrend = report.revenueTrend.filter((entry) => entry._id.currency === currency);
    const amounts = new Map<string, number>();
    for (const entry of currencyTrend) {
      const date = new Date(`${entry._id.date}T00:00:00.000Z`);
      const key = this.trendBucketKey(date);
      amounts.set(key, (amounts.get(key) ?? 0) + entry.amount);
    }

    const interval = this.trendInterval();
    const end = report.period.to ? new Date(report.period.to) : new Date();
    const start = report.period.from ? new Date(report.period.from) : new Date(end);
    if (!report.period.from) {
      if (interval === 'daily') start.setUTCDate(start.getUTCDate() - 29);
      if (interval === 'weekly') start.setUTCDate(start.getUTCDate() - 83);
      if (interval === 'monthly') {
        const firstTrendDate = currencyTrend.reduce<Date | null>((first, entry) => {
          const date = new Date(`${entry._id.date}T00:00:00.000Z`);
          return !first || date < first ? date : first;
        }, null);
        const trailingYearStart = new Date(end);
        trailingYearStart.setUTCDate(1);
        trailingYearStart.setUTCMonth(trailingYearStart.getUTCMonth() - 11);
        if (firstTrendDate && firstTrendDate < trailingYearStart) {
          start.setTime(firstTrendDate.getTime());
        } else {
          start.setTime(trailingYearStart.getTime());
        }
        start.setUTCDate(1);
      }
    }

    const maximumPoints = interval === 'daily' ? 90 : interval === 'weekly' ? 104 : 120;
    const cursor = this.startOfBucket(start, interval);
    const lastAllowedStart = new Date(end);
    if (interval === 'daily')
      lastAllowedStart.setUTCDate(lastAllowedStart.getUTCDate() - maximumPoints + 1);
    if (interval === 'weekly')
      lastAllowedStart.setUTCDate(lastAllowedStart.getUTCDate() - maximumPoints * 7 + 7);
    if (interval === 'monthly') {
      lastAllowedStart.setUTCDate(1);
      lastAllowedStart.setUTCMonth(lastAllowedStart.getUTCMonth() - maximumPoints + 1);
    }
    const minimumStart = this.startOfBucket(lastAllowedStart, interval);
    if (cursor < minimumStart) cursor.setTime(minimumStart.getTime());

    const rows: Array<{ key: string; date: Date; amount: number }> = [];
    while (cursor <= end && rows.length < maximumPoints) {
      const key = this.trendBucketKey(cursor);
      rows.push({ key, date: new Date(cursor), amount: amounts.get(key) ?? 0 });
      this.advanceBucket(cursor, interval);
    }

    const maxAmount = Math.max(1, ...rows.map((entry) => entry.amount));
    const plot = { left: 54, top: 16, width: 704, height: 184 };
    return rows.map((entry, index) => ({
      ...entry,
      label: this.trendBucketLabel(entry.date, interval),
      x:
        rows.length < 2
          ? plot.left + plot.width / 2
          : plot.left + (index / (rows.length - 1)) * plot.width,
      y: plot.top + (1 - entry.amount / maxAmount) * plot.height,
    }));
  }

  chartLinePath(): string {
    return this.chartPoints()
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }

  chartAreaPath(): string {
    const points = this.chartPoints();
    if (!points.length) return '';
    const baseline = 200;
    return `${this.chartLinePath()} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  }

  chartMaximum(): number {
    return Math.max(1, ...this.chartPoints().map((point) => point.amount));
  }

  chartTickValue(index: number): number {
    return this.chartMaximum() * (1 - index / 4);
  }

  chartTickY(index: number): number {
    return 16 + (index / 4) * 184;
  }

  chartLabelStride(): number {
    return Math.max(1, Math.ceil(this.chartPoints().length / 6));
  }

  paymentMethodSegments(): FinancialDonutSegment[] {
    const rows = (this.report()?.collectionsByMethod ?? [])
      .filter((entry) => entry._id.currency === this.paymentCurrency())
      .sort((left, right) => right.amount - left.amount);
    const total = rows.reduce((sum, entry) => sum + entry.amount, 0);
    if (!total) return [];

    const colors = ['#27ae60', '#279fe7', '#f7be17', '#a88bd0', '#e77b72'];
    let offset = 0;
    return rows.map((entry, index) => {
      const percent = (entry.amount / total) * 100;
      const segment: FinancialDonutSegment = {
        key: `${entry._id.currency}-${entry._id.method}`,
        label: this.methodLabel(entry._id.method),
        amount: entry.amount,
        percent,
        color: colors[index % colors.length],
        dasharray: `${percent} ${100 - percent}`,
        dashoffset: `${-offset}`,
      };
      offset += percent;
      return segment;
    });
  }

  paymentTotal(): number {
    return this.paymentMethodSegments().reduce((sum, segment) => sum + segment.amount, 0);
  }

  selectTrendInterval(interval: TrendInterval): void {
    this.trendInterval.set(interval);
  }

  collectionsByCurrency(): Array<{ currency: string; amount: number }> {
    const totals = new Map<string, number>();
    for (const collection of this.report()?.collectionsByMethod ?? []) {
      totals.set(
        collection._id.currency,
        (totals.get(collection._id.currency) ?? 0) + collection.amount,
      );
    }
    return Array.from(totals, ([currency, amount]) => ({ currency, amount })).sort((left, right) =>
      left.currency.localeCompare(right.currency),
    );
  }

  methodLabel(method: string): string {
    const labels: Record<string, string> = {
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
      stripe: 'Online payment',
      upi: 'UPI',
    };
    return labels[method] ?? method;
  }

  statusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .toLocaleLowerCase()
      .replace(/^\w/, (letter) => letter.toLocaleUpperCase());
  }

  customerPhotoSource(key: string, value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.unavailableCustomerImages().has(key) ? source : null;
  }

  markCustomerImageUnavailable(key: string): void {
    this.unavailableCustomerImages.update((unavailable) => new Set(unavailable).add(key));
  }

  customerInitials(name?: string | null): string {
    const initials = (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
    return initials || 'CU';
  }

  downloadInvoicePdf(invoice: RepairInvoice): void {
    if (this.downloadingInvoiceId()) return;
    this.downloadingInvoiceId.set(invoice.id);
    this.listError.set('');
    this.invoicesService
      .getShopInvoicePdf(invoice.id)
      .pipe(finalize(() => this.downloadingInvoiceId.set('')))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${invoice.invoiceNumber || 'Fixora-invoice'}.pdf`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (error: unknown) =>
          this.listError.set(getAuthErrorMessage(error, 'Invoice PDF could not be downloaded.')),
      });
  }

  exportCsv(): void {
    if (this.exportLoading()) return;
    this.reportError.set('');
    if (this.activeTab() === 'transactions' || this.activeTab() === 'payments') {
      this.exportTransactions();
      return;
    }
    if (this.activeTab() === 'invoices' || this.activeTab() === 'outstanding') {
      this.exportInvoices();
      return;
    }
    this.downloadCsv(this.exportRows());
  }

  downloadQuickReport(type: QuickReportType): void {
    if (this.exportLoading()) return;
    if (type === 'invoices') {
      this.exportInvoices(false, 'invoices');
      return;
    }
    if (type === 'outstanding') {
      this.exportInvoices(true, 'outstanding');
      return;
    }
    if (type === 'payments') {
      this.exportTransactions('payments');
      return;
    }

    const report = this.report();
    if (!report) {
      this.reportError.set('Financial reports could not be loaded.');
      return;
    }
    if (type === 'revenue') {
      this.downloadCsv([
        ['Currency', 'Revenue before tax', 'Invoice count', 'Average invoice value'],
        ...report.revenueByCurrency.map((entry) => [
          entry._id,
          entry.amount,
          entry.invoiceCount,
          entry.averageInvoiceValue,
        ]),
      ]);
      return;
    }
    this.downloadCsv([
      ['Currency', 'Tax type', 'Rate', 'Recorded tax'],
      ...report.taxByRate.map((entry) => [
        entry._id.currency,
        entry._id.type,
        entry._id.rate,
        entry.amount,
      ]),
    ]);
  }

  private exportRows(
    options: {
      transactions?: ShopFinancialTransaction[];
      invoices?: RepairInvoice[];
      tab?: FinancialReportTab;
    } = {},
  ): Array<Array<string | number>> {
    const tab = options.tab ?? this.activeTab();
    if (tab === 'transactions' || tab === 'payments') {
      return [
        [
          'Payment date',
          'Transaction',
          'Invoice',
          'Customer',
          'Method',
          'Status',
          'Amount',
          'Currency',
        ],
        ...(options.transactions ?? this.transactions()).map((transaction) => [
          transaction.paymentDate,
          transaction.transactionId,
          transaction.invoiceNumber,
          transaction.customerName,
          this.methodLabel(transaction.method),
          transaction.status,
          transaction.amount,
          transaction.currency,
        ]),
      ];
    }
    if (tab === 'invoices' || tab === 'outstanding') {
      return [
        [
          'Invoice',
          'Date',
          'Customer',
          'Repair',
          'Total',
          'Paid',
          'Balance due',
          'Currency',
          'Status',
        ],
        ...(options.invoices ?? this.invoices()).map((invoice) => [
          invoice.invoiceNumber ?? 'Draft',
          invoice.invoiceDate ?? '',
          invoice.customer.name,
          `${invoice.repair.productName} - ${invoice.repair.category}`,
          invoice.grandTotal,
          invoice.amountPaid,
          invoice.balanceDue,
          invoice.currency,
          invoice.paymentStatus,
        ]),
      ];
    }
    const report = this.report();
    if (!report) return [['Financial report'], ['No report data']];
    return [
      ['Revenue by currency', 'Amount', 'Invoice count', 'Average invoice value'],
      ...report.revenueByCurrency.map((entry) => [
        entry._id,
        entry.amount,
        entry.invoiceCount,
        entry.averageInvoiceValue,
      ]),
      [],
      ['Collections by payment method', 'Currency', 'Method', 'Amount', 'Payment count'],
      ...report.collectionsByMethod.map((entry) => [
        entry._id.currency,
        entry._id.method,
        this.methodLabel(entry._id.method),
        entry.amount,
        entry.paymentCount,
      ]),
      [],
      ['Outstanding balances', 'Amount', 'Invoice count'],
      ...report.outstandingByCurrency.map((entry) => [entry._id, entry.amount, entry.invoiceCount]),
      [],
      ['Recorded tax', 'Currency', 'Tax type', 'Rate', 'Amount'],
      ...report.taxByRate.map((entry) => [
        entry._id.currency,
        entry._id.type,
        entry._id.rate,
        entry.amount,
      ]),
      [],
      ['Refund tracking available', report.refunds.trackingAvailable ? 'Yes' : 'No'],
    ];
  }

  private periodFilters(): { from?: string; to?: string } {
    return { from: this.from() || undefined, to: this.to() || undefined };
  }

  private transactionFilters(
    page: number,
    limit: number,
    tab: FinancialReportTab = this.activeTab(),
  ): ShopFinancialTransactionsFilters {
    return {
      ...this.periodFilters(),
      search: this.search().trim() || undefined,
      method: this.paymentMethod(),
      status: tab === 'payments' ? 'succeeded' : this.paymentStatus(),
      page,
      limit,
    };
  }

  private invoiceFilters(
    page: number,
    limit: number,
    tab: FinancialReportTab = this.activeTab(),
  ): RepairInvoiceListFilters {
    return {
      ...this.periodFilters(),
      search: this.search().trim() || undefined,
      paymentStatus: this.invoicePaymentStatus(),
      outstandingOnly: tab === 'outstanding' ? 'true' : undefined,
      page,
      limit,
    };
  }

  private exportTransactions(tab: FinancialReportTab = this.activeTab()): void {
    const filters = this.transactionFilters(1, 100, tab);
    this.exportLoading.set(true);
    this.invoicesService
      .listShopFinancialTransactions(filters)
      .pipe(
        expand((result) =>
          result.pagination.page < result.pagination.totalPages
            ? this.invoicesService.listShopFinancialTransactions({
                ...filters,
                page: result.pagination.page + 1,
              })
            : EMPTY,
        ),
        reduce(
          (transactions, result) => transactions.concat(result.transactions),
          [] as ShopFinancialTransaction[],
        ),
        finalize(() => this.exportLoading.set(false)),
      )
      .subscribe({
        next: (transactions) => this.downloadCsv(this.exportRows({ transactions, tab })),
        error: (error: unknown) =>
          this.reportError.set(
            getAuthErrorMessage(error, 'Payment transactions could not be exported.'),
          ),
      });
  }

  private exportInvoices(
    outstandingOnly = this.activeTab() === 'outstanding',
    tab: FinancialReportTab = this.activeTab(),
  ): void {
    const filters = this.invoiceFilters(1, 100, tab);
    filters.outstandingOnly = outstandingOnly ? 'true' : undefined;
    this.exportLoading.set(true);
    this.invoicesService
      .listShopInvoices(filters)
      .pipe(
        expand((result) =>
          result.page < result.totalPages
            ? this.invoicesService.listShopInvoices({
                ...filters,
                page: result.page + 1,
              })
            : EMPTY,
        ),
        reduce((invoices, result) => invoices.concat(result.invoices), [] as RepairInvoice[]),
        finalize(() => this.exportLoading.set(false)),
      )
      .subscribe({
        next: (invoices) => this.downloadCsv(this.exportRows({ invoices, tab })),
        error: (error: unknown) =>
          this.reportError.set(
            getAuthErrorMessage(error, 'Repair invoices could not be exported.'),
          ),
      });
  }

  private downloadCsv(rows: Array<Array<string | number>>): void {
    const csv = rows.map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${this.from() || 'all'}-${this.to() || 'all'}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private csvCell(value: string | number): string {
    const text = String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private trendBucketKey(date: Date): string {
    const normalized = new Date(date);
    if (this.trendInterval() === 'weekly') {
      normalized.setUTCDate(normalized.getUTCDate() - ((normalized.getUTCDay() + 6) % 7));
    }
    const year = normalized.getUTCFullYear();
    const month = `${normalized.getUTCMonth() + 1}`.padStart(2, '0');
    if (this.trendInterval() === 'monthly') return `${year}-${month}`;
    const day = `${normalized.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfBucket(date: Date, interval: TrendInterval): Date {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (interval === 'weekly') {
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    }
    if (interval === 'monthly') start.setUTCDate(1);
    return start;
  }

  private advanceBucket(date: Date, interval: TrendInterval): void {
    if (interval === 'daily') date.setUTCDate(date.getUTCDate() + 1);
    if (interval === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
    if (interval === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  }

  private trendBucketLabel(date: Date, interval: TrendInterval): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      ...(interval === 'monthly' ? { year: '2-digit' as const } : { day: 'numeric' as const }),
      timeZone: 'UTC',
    }).format(date);
  }
}
