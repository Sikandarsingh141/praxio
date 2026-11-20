import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../../../core/auth/auth-error-message';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../confirmation-dialog/confirmation-dialog.component';
import {
  RecordRepairInvoicePaymentInput,
  RepairInvoice,
  RepairInvoicePaymentMethod,
} from '../../models/repair-invoice.models';
import { RepairInvoicesService } from '../../services/repair-invoices.service';

type InvoicePortal = 'customer' | 'shop';
type ManualPaymentMethod = Exclude<RepairInvoicePaymentMethod, 'stripe'>;

@Component({
  selector: 'app-repair-invoice-section',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './repair-invoice-section.component.html',
  styleUrl: './repair-invoice-section.component.scss',
})
export class RepairInvoiceSectionComponent implements OnInit, OnDestroy {
  @Input({ required: true }) repairRequestId = '';
  @Input() mode: InvoicePortal = 'customer';

  readonly invoice = signal<RepairInvoice | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly previewLoading = signal(false);
  readonly downloadLoading = signal(false);
  readonly paymentLoading = signal(false);
  readonly error = signal('');
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  private readonly confirmationAction = signal<'issue' | 'cancel' | null>(null);
  readonly paymentMethods: Array<{ value: ManualPaymentMethod; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank transfer' },
  ];

  paymentAmount: number | null = null;
  paymentMethod: ManualPaymentMethod = 'cash';
  paymentReference = '';
  paymentDate = new Date().toISOString().slice(0, 10);

  private readonly invoices = inject(RepairInvoicesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private previewObjectUrl: string | null = null;

  ngOnInit(): void {
    this.loadInvoice();
  }

  ngOnDestroy(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
  }

  loadInvoice(): void {
    this.loading.set(true);
    this.error.set('');
    const request =
      this.mode === 'shop'
        ? this.invoices.getShopInvoiceForRepair(this.repairRequestId)
        : this.invoices.getCustomerInvoiceForRepair(this.repairRequestId);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(getAuthErrorMessage(error, 'Invoice details could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  createDraft(): void {
    if (this.mode !== 'shop' || this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    this.invoices
      .createShopDraft(this.repairRequestId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (invoice) => this.invoice.set(invoice),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'The invoice draft could not be created.')),
      });
  }

  previewDraft(): void {
    const invoice = this.invoice();
    if (this.mode !== 'shop' || !invoice || invoice.invoiceStatus !== 'draft') return;
    this.previewLoading.set(true);
    this.error.set('');
    this.invoices
      .previewShopDraft(invoice.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.previewLoading.set(false)),
      )
      .subscribe({
        next: (pdf) => this.setPreview(pdf),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Invoice preview could not be generated.')),
      });
  }

  issueInvoice(): void {
    const invoice = this.invoice();
    if (
      this.mode !== 'shop' ||
      !invoice ||
      invoice.invoiceStatus !== 'draft' ||
      this.saving()
    ) {
      return;
    }
    this.confirmationAction.set('issue');
    this.confirmation.set({
      title: 'Issue invoice?',
      message: 'Its number and billing details will be locked once issued.',
      confirmLabel: 'Issue invoice',
      cancelLabel: 'Keep editing',
    });
  }

  confirmPendingAction(): void {
    const action = this.confirmationAction();
    this.closeConfirmation();
    if (action === 'issue') this.issueConfirmedInvoice();
    if (action === 'cancel') this.cancelConfirmedInvoice();
  }

  closeConfirmation(): void {
    this.confirmation.set(null);
    this.confirmationAction.set(null);
  }

  private issueConfirmedInvoice(): void {
    const invoice = this.invoice();
    if (
      this.mode !== 'shop' ||
      !invoice ||
      invoice.invoiceStatus !== 'draft' ||
      this.saving()
    ) {
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.invoices
      .issueShopInvoice(invoice.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (issuedInvoice) => {
          this.invoice.set(issuedInvoice);
          this.clearPreview();
        },
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'The invoice could not be issued.')),
      });
  }

  cancelInvoice(): void {
    const invoice = this.invoice();
    if (
      this.mode !== 'shop' ||
      !invoice ||
      invoice.invoiceStatus !== 'issued' ||
      invoice.amountPaid > 0 ||
      this.saving()
    ) {
      return;
    }
    this.confirmationAction.set('cancel');
    this.confirmation.set({
      title: 'Cancel invoice?',
      message:
        'The issued PDF and invoice record will remain available for history.',
      confirmLabel: 'Cancel invoice',
      cancelLabel: 'Keep invoice',
      destructive: true,
    });
  }

  private cancelConfirmedInvoice(): void {
    const invoice = this.invoice();
    if (
      this.mode !== 'shop' ||
      !invoice ||
      invoice.invoiceStatus !== 'issued' ||
      invoice.amountPaid > 0 ||
      this.saving()
    ) {
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.invoices
      .cancelShopInvoice(invoice.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (cancelledInvoice) => this.invoice.set(cancelledInvoice),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'The invoice could not be cancelled.')),
      });
  }

  viewPdf(): void {
    const invoice = this.invoice();
    if (
      !invoice ||
      (invoice.invoiceStatus !== 'issued' && invoice.invoiceStatus !== 'cancelled') ||
      this.downloadLoading()
    ) {
      return;
    }
    this.downloadLoading.set(true);
    this.error.set('');
    const request =
      this.mode === 'shop'
        ? this.invoices.getShopInvoicePdf(invoice.id)
        : this.invoices.getCustomerInvoicePdf(invoice.id);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloadLoading.set(false)),
      )
      .subscribe({
        next: (pdf) => this.setPreview(pdf),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'The invoice PDF could not be opened.')),
      });
  }

  downloadPdf(): void {
    const invoice = this.invoice();
    if (
      !invoice ||
      (invoice.invoiceStatus !== 'issued' && invoice.invoiceStatus !== 'cancelled') ||
      this.downloadLoading()
    ) {
      return;
    }
    this.downloadLoading.set(true);
    this.error.set('');
    const request =
      this.mode === 'shop'
        ? this.invoices.getShopInvoicePdf(invoice.id)
        : this.invoices.getCustomerInvoicePdf(invoice.id);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloadLoading.set(false)),
      )
      .subscribe({
        next: (pdf) => this.savePdf(pdf, invoice.invoiceNumber || 'Fixora-invoice'),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'The invoice PDF could not be downloaded.')),
      });
  }

  recordPayment(): void {
    const invoice = this.invoice();
    const amount = Number(this.paymentAmount);
    if (
      this.mode !== 'shop' ||
      !invoice ||
      invoice.invoiceStatus !== 'issued' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      this.paymentLoading()
    ) {
      return;
    }

    const payment: RecordRepairInvoicePaymentInput = {
      amount,
      method: this.paymentMethod,
      paymentDate: this.paymentDate,
      reference: this.paymentReference.trim() || undefined,
    };
    this.error.set('');
    this.paymentLoading.set(true);
    this.invoices
      .recordManualPayment(invoice.id, payment)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.paymentLoading.set(false)),
      )
      .subscribe({
        next: (updatedInvoice) => {
          this.invoice.set(updatedInvoice);
          this.paymentAmount = null;
          this.paymentReference = '';
        },
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Payment could not be recorded.')),
      });
  }

  payOnline(): void {
    const invoice = this.invoice();
    if (
      this.mode !== 'customer' ||
      !invoice ||
      invoice.invoiceStatus !== 'issued' ||
      invoice.balanceDue <= 0 ||
      this.paymentLoading()
    ) {
      return;
    }
    this.error.set('');
    this.paymentLoading.set(true);
    this.invoices
      .createCustomerCheckout(invoice.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.paymentLoading.set(false)),
      )
      .subscribe({
        next: (checkoutUrl) => window.location.assign(checkoutUrl),
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Secure checkout could not be started.')),
      });
  }

  taxTotal(invoice: RepairInvoice): number {
    return invoice.taxDetails.reduce((total, tax) => total + tax.amount, 0);
  }

  statusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .toLocaleLowerCase()
      .replace(/^\w/, (letter) => letter.toLocaleUpperCase());
  }

  private setPreview(pdf: Blob): void {
    this.clearPreview();
    this.previewObjectUrl = URL.createObjectURL(pdf);
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
  }

  private clearPreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
    this.previewUrl.set(null);
  }

  private savePdf(pdf: Blob, invoiceNumber: string): void {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
