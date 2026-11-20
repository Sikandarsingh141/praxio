import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RepairInvoice } from '../../models/repair-invoice.models';
import { RepairInvoicesService } from '../../services/repair-invoices.service';
import { RepairInvoiceSectionComponent } from './repair-invoice-section.component';

describe('RepairInvoiceSectionComponent', () => {
  const invoice: RepairInvoice = {
    id: 'invoice-123',
    repairRequestId: 'repair-123',
    invoiceNumber: 'FIX-INV-2026-000001',
    invoiceDate: '2026-11-20T00:00:00.000Z',
    dueDate: null,
    invoiceStatus: 'issued',
    paymentStatus: 'UNPAID',
    currency: 'INR',
    items: [{ description: 'Repair service charges', quantity: 1, unitPrice: 500, amount: 500 }],
    subtotal: 500,
    discount: 0,
    taxableAmount: 500,
    taxDetails: [],
    grandTotal: 500,
    amountPaid: 0,
    balanceDue: 500,
    customer: { name: 'Customer One' },
    shop: { name: 'Repair Shop' },
    repair: {
      category: 'Phone',
      productName: 'Phone',
      problemDescription: 'Screen replacement',
    },
    payments: [],
    pdfAvailable: true,
  };
  let invoices: jasmine.SpyObj<RepairInvoicesService>;

  beforeEach(async () => {
    invoices = jasmine.createSpyObj<RepairInvoicesService>('RepairInvoicesService', [
      'getShopInvoiceForRepair',
      'createShopDraft',
      'previewShopDraft',
      'issueShopInvoice',
      'cancelShopInvoice',
      'getShopInvoicePdf',
      'recordManualPayment',
      'getCustomerInvoiceForRepair',
      'getCustomerInvoicePdf',
      'createCustomerCheckout',
    ]);
    invoices.getShopInvoiceForRepair.and.returnValue(of(null));
    invoices.getCustomerInvoiceForRepair.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [RepairInvoiceSectionComponent],
      providers: [{ provide: RepairInvoicesService, useValue: invoices }],
    }).compileComponents();
  });

  it('shows the customer a message until the shop issues an invoice', () => {
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'customer');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invoice-section')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'The shop has not generated the invoice yet.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'It will appear here once the shop issues it.',
    );
  });

  it('shows the issued invoice and outstanding payment action to its customer', () => {
    invoices.getCustomerInvoiceForRepair.and.returnValue(of(invoice));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'customer');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.invoice-section')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('FIX-INV-2026-000001');
    expect(fixture.nativeElement.textContent).toContain('#PAIR-123');
    expect(fixture.nativeElement.textContent).toContain('Unpaid');
    expect(fixture.nativeElement.textContent).toContain('Pay online');
  });

  it('allows the shop to prepare an invoice when none exists', () => {
    invoices.createShopDraft.and.returnValue(
      of({ ...invoice, invoiceStatus: 'draft', invoiceNumber: null }),
    );
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'shop');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-button') as HTMLButtonElement;
    expect(button.textContent).toContain('Generate Invoice');
    button.click();
    fixture.detectChanges();

    expect(invoices.createShopDraft).toHaveBeenCalledOnceWith(invoice.repairRequestId);
    expect(fixture.nativeElement.textContent).toContain('#PAIR-123');
    expect(fixture.nativeElement.textContent).toContain('Assigned when issued');
    expect(fixture.nativeElement.textContent).toContain('Preview PDF');
  });

  it('issues a draft invoice after confirmation without requiring a PDF preview', () => {
    const nativeConfirm = spyOn(window, 'confirm');
    const draft = { ...invoice, invoiceStatus: 'draft' as const, invoiceNumber: null };
    invoices.getShopInvoiceForRepair.and.returnValue(of(draft));
    invoices.issueShopInvoice.and.returnValue(of(invoice));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'shop');
    fixture.detectChanges();

    const issueButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Confirm and issue invoice'));
    expect(issueButton?.disabled).toBeFalse();
    issueButton?.click();
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.querySelector(
      'app-confirmation-dialog',
    ) as HTMLElement;
    expect(confirmation.textContent).toContain('Issue invoice?');
    expect(confirmation.textContent).toContain(
      'Its number and billing details will be locked once issued.',
    );
    expect(invoices.issueShopInvoice).not.toHaveBeenCalled();
    (confirmation.querySelector('.confirm-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(invoices.issueShopInvoice).toHaveBeenCalledOnceWith(invoice.id);
    expect(fixture.nativeElement.textContent).toContain('Issued');
  });

  it('shows placeholders for manual shop payment inputs', () => {
    invoices.getShopInvoiceForRepair.and.returnValue(of(invoice));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'shop');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('input[name="paymentAmount"]')?.getAttribute('placeholder'),
    ).toBe('0.00');
    expect(
      fixture.nativeElement
        .querySelector('input[name="paymentReference"]')
        ?.getAttribute('placeholder'),
    ).toBe('e.g. UTR123456789');
  });

  it('places cancel immediately before the download button on issued shop invoices', () => {
    invoices.getShopInvoiceForRepair.and.returnValue(of(invoice));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'shop');
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelector('.invoice-actions') as HTMLElement;
    const buttons = Array.from(actions.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );
    expect(buttons).toEqual(['View Invoice', 'Cancel invoice', 'Download Invoice PDF']);
    const cancelButton = actions.querySelector('.invoice-cancel-button') as HTMLElement;
    const downloadButton = actions.querySelector('.invoice-download-button') as HTMLElement;
    expect(getComputedStyle(cancelButton).width).toBe(getComputedStyle(downloadButton).width);
    expect(
      Number.parseFloat(getComputedStyle(cancelButton).marginLeft),
    ).toBeGreaterThan(0);
  });

  it('places pay online immediately before download at the right with matching widths', () => {
    invoices.getCustomerInvoiceForRepair.and.returnValue(of(invoice));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'customer');
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelector('.invoice-actions') as HTMLElement;
    const buttons = Array.from(actions.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );
    expect(buttons).toEqual(['View Invoice', 'Pay online', 'Download Invoice PDF']);
    const payButton = actions.querySelector('.invoice-pay-online-button') as HTMLElement;
    const downloadButton = actions.querySelector('.invoice-download-button') as HTMLElement;
    expect(getComputedStyle(payButton).width).toBe(getComputedStyle(downloadButton).width);
    expect(Number.parseFloat(getComputedStyle(payButton).marginLeft)).toBeGreaterThan(0);
  });

  it('requires confirmation before cancelling an unpaid issued invoice', () => {
    const nativeConfirm = spyOn(window, 'confirm');
    invoices.getShopInvoiceForRepair.and.returnValue(of(invoice));
    invoices.cancelShopInvoice.and.returnValue(of({ ...invoice, invoiceStatus: 'cancelled' }));
    const fixture = TestBed.createComponent(RepairInvoiceSectionComponent);
    fixture.componentRef.setInput('repairRequestId', invoice.repairRequestId);
    fixture.componentRef.setInput('mode', 'shop');
    fixture.detectChanges();

    const cancelButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Cancel invoice'));
    expect(cancelButton).toBeDefined();
    cancelButton?.click();
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.querySelector(
      'app-confirmation-dialog',
    ) as HTMLElement;
    expect(confirmation.textContent).toContain('Cancel invoice?');
    (confirmation.querySelector('.confirm-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(invoices.cancelShopInvoice).toHaveBeenCalledOnceWith(invoice.id);
    expect(fixture.nativeElement.textContent).toContain('Cancelled');
    expect(fixture.nativeElement.textContent).toContain('Download Invoice PDF');
  });
});
