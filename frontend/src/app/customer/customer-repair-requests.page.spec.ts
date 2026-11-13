import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CustomerRepairRequest } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerRepairRequestsPage } from './customer-repair-requests.page';

describe('CustomerRepairRequestsPage editing', () => {
  const request: CustomerRepairRequest = {
    _id: 'request-id',
    shopIds: ['shop-id'],
    appliance: 'Refrigerator',
    description: 'Not cooling',
    status: 'open',
    createdAt: '2026-11-01T00:00:00.000Z',
    quotations: [],
    shops: [{ id: 'shop-id', name: 'Repair Shop', responseStatus: 'new' }],
  };
  let portal: jasmine.SpyObj<CustomerPortalService>;

  beforeEach(async () => {
    portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getRepairRequests',
      'searchShops',
      'updateRepairRequest',
      'updateQuotationStatus',
    ]);
    portal.getRepairRequests.and.returnValue(of([request]));
    portal.searchShops.and.returnValue(of([]));
    portal.updateRepairRequest.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairRequestsPage],
      providers: [provideRouter([]), { provide: CustomerPortalService, useValue: portal }],
    }).compileComponents();
  });

  it('offers editing only for open requests without quotations or repair jobs', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    const page = fixture.componentInstance;

    expect(page.canEditRequest(request)).toBeTrue();
    expect(
      page.canEditRequest({
        ...request,
        quotations: [{ _id: 'quote-id' } as CustomerRepairRequest['quotations'][number]],
      }),
    ).toBeFalse();
    expect(page.canEditRequest({ ...request, status: 'cancelled' })).toBeFalse();
    expect(page.canEditRequest({ ...request, repairJob: { status: 'confirmed' } })).toBeFalse();
  });

  it('offers cancellation only while no shop has submitted a quotation or received a decision', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    const page = fixture.componentInstance;

    expect(page.canCancelRequest(request)).toBeTrue();
    expect(
      page.canCancelRequest({
        ...request,
        shops: [{ id: 'shop-id', name: 'Repair Shop', responseStatus: 'quotation_submitted' }],
      }),
    ).toBeFalse();
    expect(
      page.canCancelRequest({
        ...request,
        shops: [{ id: 'shop-id', name: 'Repair Shop', responseStatus: 'customer_rejected' }],
      }),
    ).toBeFalse();
  });

  it('shows the request lifecycle status instead of marking every repair job active', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    const page = fixture.componentInstance;
    portal.getRepairRequests.and.returnValue(
      of([
        { ...request, _id: 'active', repairJob: { status: 'in_progress' } },
        { ...request, _id: 'completed', repairJob: { status: 'completed' } },
        { ...request, _id: 'disputed', repairJob: { status: 'disputed' } },
        { ...request, _id: 'cancelled', status: 'cancelled' },
      ]),
    );
    page.loadRequests();
    fixture.detectChanges();

    const statuses = Array.from(
      fixture.nativeElement.querySelectorAll('.request-card .status'),
      (element: Element) => element.textContent?.trim(),
    );
    expect(statuses).toEqual(['Active', 'Completed', 'Active', 'Cancelled']);
  });

  it('filters request cards by lifecycle status and sorts them by date', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    const page = fixture.componentInstance;
    portal.getRepairRequests.and.returnValue(
      of([
        { ...request, _id: 'older', appliance: 'Older request', createdAt: '2026-10-01' },
        {
          ...request,
          _id: 'active',
          appliance: 'Active repair',
          createdAt: '2026-11-02',
          repairJob: { status: 'in_progress' },
        },
        {
          ...request,
          _id: 'completed',
          appliance: 'Completed repair',
          createdAt: '2026-11-03',
          repairJob: { status: 'completed' },
        },
      ]),
    );
    page.loadRequests();
    fixture.detectChanges();

    expect(page.statusCount('all')).toBe(3);
    expect(page.statusCount('open')).toBe(1);
    expect(page.statusCount('in_progress')).toBe(1);
    expect(page.statusCount('completed')).toBe(1);
    expect(page.visibleRequests().map((item) => item._id)).toEqual([
      'completed',
      'active',
      'older',
    ]);

    page.selectStatus('in_progress');
    expect(page.visibleRequests().map((item) => item._id)).toEqual(['active']);
    page.selectStatus('all');
    page.sortOrder.set('oldest');
    expect(page.visibleRequests().map((item) => item._id)).toEqual([
      'older',
      'active',
      'completed',
    ]);
  });

  it('shows ten requests per page and resets paging when the status filter changes', () => {
    const requests = Array.from({ length: 11 }, (_, index) => ({
      ...request,
      _id: `request-${index}`,
      appliance: `Request ${index}`,
      ...(index === 10 ? { repairJob: { status: 'completed' as const } } : {}),
    }));
    portal.getRepairRequests.and.returnValue(of(requests));
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    expect(fixture.nativeElement.querySelectorAll('.request-card').length).toBe(10);
    expect(fixture.nativeElement.querySelector('app-pagination nav')).toBeTruthy();

    page.goToPage(2);
    fixture.detectChanges();
    expect(page.page()).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.request-card').length).toBe(1);

    page.selectStatus('completed');
    fixture.detectChanges();
    expect(page.page()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.request-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('app-pagination nav')).toBeTruthy();
  });

  it('renders request photos in the customer request list', () => {
    portal.getRepairRequests.and.returnValue(
      of([
        {
          ...request,
          photos: [{ mimeType: 'image/png', data: 'data:image/png;base64,abc' }],
        },
      ]),
    );
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.request-photos img') as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.src).toContain('data:image/png;base64,abc');
    expect(image.alt).toBe('Repair photo 1 for Refrigerator');
  });

  it('shows a detail-page action for requests without an active repair job', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    fixture.detectChanges();

    const detailLink = fixture.nativeElement.querySelector(
      '.repair-progress-link',
    ) as HTMLAnchorElement;
    expect(detailLink).toBeTruthy();
    expect(detailLink.textContent.trim()).toBe('View details');
    expect(detailLink.getAttribute('href')).toBe('/customer/repair-requests/request-id');
  });

  it('opens the edit form and submits the updated request fields', () => {
    const fixture = TestBed.createComponent(CustomerRepairRequestsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.openEdit(request);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Edit repair request');
    page.editAppliance.set('Updated refrigerator');
    page.editBrand.set('Updated brand');
    page.editDescription.set('Updated issue details');
    page.editServiceType.set('home_service');
    page.saveEdit();

    expect(portal.updateRepairRequest).toHaveBeenCalledWith(
      'request-id',
      jasmine.objectContaining({
        shopIds: ['shop-id'],
        appliance: 'Updated refrigerator',
        brand: 'Updated brand',
        description: 'Updated issue details',
        serviceType: 'home_service',
      }),
    );
    expect(page.editRequest()).toBeNull();
    expect(page.actionMessage()).toBe('Your repair request was updated.');
  });
});
