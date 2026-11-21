import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RepairInvoice, RepairInvoicePage } from '../../shared/models/repair-invoice.models';
import { RepairInvoicesService } from '../../shared/services/repair-invoices.service';
import { ShopInvoicesPage } from './shop-invoices.page';

describe('ShopInvoicesPage', () => {
  let fixture: ComponentFixture<ShopInvoicesPage>;
  let invoicesService: jasmine.SpyObj<RepairInvoicesService>;

  const invoice: RepairInvoice = {
    id: 'invoice-1',
    repairRequestId: 'repair-request-1',
    invoiceNumber: 'FIX-INV-2026-000001',
    invoiceDate: '2026-11-20T00:00:00.000Z',
    dueDate: null,
    invoiceStatus: 'issued',
    paymentStatus: 'PAID',
    currency: 'INR',
    items: [],
    subtotal: 100,
    discount: 0,
    taxableAmount: 100,
    taxDetails: [],
    grandTotal: 100,
    amountPaid: 100,
    balanceDue: 0,
    customer: {
      name: 'Sikandar Customer',
      profileImageUrl: 'data:image/png;base64,YWJj',
    },
    shop: { name: 'Repair Shop' },
    repair: {
      category: 'Mobile',
      productName: 'Phone',
      problemDescription: 'Screen repair',
    },
    payments: [],
    pdfAvailable: true,
  };

  beforeEach(async () => {
    invoicesService = jasmine.createSpyObj<RepairInvoicesService>('RepairInvoicesService', [
      'listShopInvoices',
      'getShopInvoicePdf',
    ]);
    invoicesService.listShopInvoices.and.returnValue(
      of({
        invoices: [invoice],
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      } satisfies RepairInvoicePage),
    );

    await TestBed.configureTestingModule({
      imports: [ShopInvoicesPage],
      providers: [provideRouter([]), { provide: RepairInvoicesService, useValue: invoicesService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopInvoicesPage);
    fixture.detectChanges();
  });

  it('shows the customer photo and name with the shared filter and pagination controls', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.customer-name')?.textContent?.trim()).toBe('Sikandar Customer');
    expect(element.querySelector<HTMLImageElement>('.customer-avatar')?.alt).toBe(
      'Sikandar Customer profile photo',
    );
    expect(element.querySelector('app-job-pagination')).toBeTruthy();

    element.querySelector<HTMLButtonElement>('.action-btn-more')?.click();
    fixture.detectChanges();

    expect(document.body.querySelector('.job-action-menu')?.textContent).toContain('View Details');
    expect(document.body.querySelector('.job-action-menu')?.textContent).toContain('Download PDF');

    element.querySelector<HTMLButtonElement>('.filter-trigger')?.click();
    fixture.detectChanges();

    expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Invoice filters');
  });
});
