import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShopJobsTableComponent } from './shop-jobs-table.component';

describe('ShopJobsTableComponent', () => {
  it('renders request details and links each row to its stage detail page', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopJobsTableComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopJobsTableComponent);
    fixture.componentInstance.jobs = [
      {
        id: 'request-12345678',
        title: 'Washing machine',
        status: 'inspection_pending',
        description: 'Not draining',
        customerName: 'Ava Customer',
        customerProfileImageUrl: 'Y3VzdG9tZXI=',
        brand: 'Fixora',
        model: 'WM-1',
        createdAt: '2026-01-15T12:00:00.000Z',
      },
    ];
    fixture.componentInstance.detailRoute = '/shop/jobs/assigned-jobs';
    fixture.componentInstance.title = 'Assigned Requests';
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLTableRowElement;
    const actionsButton = row.querySelector('button') as HTMLButtonElement;
    expect(row.textContent).toContain('#12345678');
    expect(fixture.nativeElement.textContent).toContain('Request ID');
    expect(row.textContent).toContain('Washing machine');
    expect(row.textContent).toContain('Ava Customer');
    expect(
      (row.querySelector('img.customer-avatar') as HTMLImageElement).src,
    ).toContain('data:image/jpeg;base64,Y3VzdG9tZXI=');
    expect(row.textContent).toContain('Not draining');
    expect(row.textContent).toContain('Inspection pending');
    expect(actionsButton.getAttribute('aria-expanded')).toBe('false');

    fixture.componentInstance.toggleActions('request-12345678');
    fixture.detectChanges();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const detailsLink = overlay.querySelector('a') as HTMLAnchorElement | null;
    expect(actionsButton.getAttribute('aria-expanded')).toBe('true');
    expect(detailsLink?.getAttribute('href')).toBe('/shop/jobs/assigned-jobs/request-12345678');
    expect(detailsLink?.textContent).toContain('View Details');
  });

  it('shows quotation status when requested by the new-jobs listing', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopJobsTableComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopJobsTableComponent);
    fixture.componentInstance.jobs = [
      {
        id: 'request-1',
        title: 'Laptop',
        status: 'new',
        description: 'Screen issue',
        createdAt: '2026-01-15T12:00:00.000Z',
        quotationSubmitted: true,
      },
    ];
    fixture.componentInstance.detailRoute = '/shop/jobs/new-jobs';
    fixture.componentInstance.showQuotationStatus = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Quotation');
    expect(fixture.nativeElement.textContent).toContain('Submitted');
  });

  it('shows assignee and assignment date in the assigned-jobs table', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopJobsTableComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopJobsTableComponent);
    fixture.componentInstance.jobs = [
      {
        id: 'request-owner-12345678',
        title: 'Television',
        status: 'assigned',
        description: 'No display',
        customerName: 'Ava Customer',
        assignedToId: 'owner',
        assignedToName: 'You',
        assignedToOwner: true,
        assignedAt: '2026-11-16T10:24:00.000Z',
        createdAt: '2026-11-15T12:00:00.000Z',
      },
      {
        id: 'request-tech-12345679',
        title: 'Refrigerator',
        status: 'assigned',
        description: 'Not cooling',
        customerName: 'Sam Customer',
        assignedToId: 'tech-1',
        assignedToName: 'Rahul Verma',
        assignedAt: '2026-11-16T09:40:00.000Z',
        createdAt: '2026-11-15T12:00:00.000Z',
      },
    ];
    fixture.componentInstance.detailRoute = '/shop/jobs/assigned-jobs';
    fixture.componentInstance.showAssignmentDetails = true;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((header) => header.textContent?.trim());
    expect(headers).toContain('Request ID');
    expect(headers).toContain('Assigned To');
    expect(headers).toContain('Assigned On');
    expect(headers).not.toContain('Request Date');
    expect(text).toContain('You');
    expect(text).toContain('(Shop Owner)');
    expect(text).toContain('Rahul Verma');
    expect(text).toContain('Nov 16, 2026');
    expect(fixture.nativeElement.querySelector('.action-btn-view')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.action-btn-more').length).toBe(2);
  });

  it('uses the assignment date label and value for technician job lists', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopJobsTableComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopJobsTableComponent);
    fixture.componentInstance.jobs = [
      {
        id: 'request-tech-12345679',
        title: 'Refrigerator',
        status: 'active',
        description: 'Not cooling',
        createdAt: '2026-11-15T12:00:00.000Z',
        assignedAt: '2026-11-16T09:40:00.000Z',
      },
    ];
    fixture.componentInstance.detailRoute = '/technician/active-jobs';
    fixture.componentInstance.title = 'Active Repairs';
    fixture.componentInstance.dateLabel = 'Assigned On';
    fixture.componentInstance.showAssignedDate = true;
    fixture.detectChanges();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((header) => header.textContent?.trim());
    const dateCell = fixture.nativeElement.querySelector('.td-date') as HTMLElement;
    expect(headers).toContain('Assigned On');
    expect(headers).not.toContain('Request Date');
    expect(dateCell.textContent).toContain('Nov 16, 2026');
    expect(dateCell.textContent).not.toContain('Nov 15, 2026');
  });
});
