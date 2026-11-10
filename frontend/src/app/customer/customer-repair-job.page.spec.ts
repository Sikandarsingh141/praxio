import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerRepairJobPage } from './customer-repair-job.page';

describe('CustomerRepairJobPage', () => {
  it('renders request details and selected shops from the loaded repair request', async () => {
    const request = {
      _id: 'request-id-12345678',
      shopIds: ['shop-1'],
      appliance: 'Air conditioner',
      brand: 'Fixroa',
      model: 'AC-100',
      description: 'Not cooling',
      preferredServiceDate: '2026-11-10T00:00:00.000Z',
      serviceType: 'shop_visit' as const,
      status: 'open' as const,
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shops: [{ id: 'shop-1', name: 'Amit Sharma', responseStatus: 'new' }],
    };
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getRepairJob',
    ]);
    portal.getRepairJob.and.returnValue(of(request));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        {
          provide: CustomerPortalService,
          useValue: portal,
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => request._id } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(portal.getRepairJob).toHaveBeenCalledWith(request._id);
    expect(text).toContain('REPAIR REQUEST DETAILS');
    expect(text).toContain('Request ID:');
    expect(text).toContain('12345678');
    expect(text).toContain('Issue / Problem');
    expect(text).toContain('Not cooling');
    expect(text).toContain('Preferred Date');
    expect(text).toContain('Shop visit');
    expect(text).toContain('Amit Sharma');
    expect(text).toContain('AS');
    expect(text).toContain('View Quotations');
    expect(fixture.nativeElement.querySelector('.status-badge')?.textContent).toContain('Open');
  });
});
