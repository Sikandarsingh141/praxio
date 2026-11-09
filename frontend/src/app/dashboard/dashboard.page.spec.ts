import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard.page';
import { CustomerRepairRequest } from '../customer/customer-portal.models';

describe('DashboardPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('shows the customer dashboard and honest empty states for unavailable features', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    http.expectOne('/api/customer/repair-requests').flush({ data: { requests: [] } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Your dashboard');
    expect(text).toContain('Explore repair services');
    expect(text).toContain('Air conditioning');
    expect(text).toContain('Find a repair expert near you');
    expect(text).toContain('Choose a service to find matching shops');
    expect(text).toContain('No repair requests yet');
  });

  it('shows accurate lifecycle labels and dashboard counts for repairs', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const requests: CustomerRepairRequest[] = [
      {
        _id: 'open',
        shopIds: [],
        appliance: 'Open request',
        description: 'Waiting for quotation',
        status: 'open',
        createdAt: '2026-11-09T00:00:00.000Z',
        quotations: [],
      },
      {
        _id: 'active',
        shopIds: [],
        appliance: 'Active repair',
        description: 'Being repaired',
        status: 'open',
        createdAt: '2026-11-08T00:00:00.000Z',
        quotations: [],
        repairJob: { status: 'in_progress' },
      },
      {
        _id: 'completed',
        shopIds: [],
        appliance: 'Completed repair',
        description: 'Repair finished',
        status: 'open',
        createdAt: '2026-11-07T00:00:00.000Z',
        quotations: [],
        repairJob: { status: 'completed' },
      },
      {
        _id: 'disputed',
        shopIds: [],
        appliance: 'Disputed repair',
        description: 'Needs rework',
        status: 'open',
        createdAt: '2026-11-06T00:00:00.000Z',
        quotations: [],
        repairJob: { status: 'disputed' },
      },
    ];
    http.expectOne('/api/customer/repair-requests').flush({ data: { requests } });
    fixture.detectChanges();

    const statusLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.recent-request-status'),
      (element: Element) => element.textContent?.trim(),
    );
    expect(statusLabels).toEqual(['Open', 'Active', 'Completed']);

    const stats = Array.from(
      fixture.nativeElement.querySelectorAll('.stat-card'),
      (element: Element) => ({
        label: element.querySelector('.stat-label')?.textContent?.trim(),
        value: element.querySelector('.stat-value')?.textContent?.trim(),
      }),
    );
    expect(stats).toEqual([
      { label: 'Total requests', value: '4' },
      { label: 'Open requests', value: '1' },
      { label: 'Active repairs', value: '2' },
      { label: 'Completed', value: '1' },
    ]);
  });
});
