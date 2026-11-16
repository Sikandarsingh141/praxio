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
        brand: 'Fixora',
        model: 'WM-1',
        createdAt: '2026-01-15T12:00:00.000Z',
      },
    ];
    fixture.componentInstance.detailRoute = '/shop/jobs/assigned-jobs';
    fixture.componentInstance.title = 'Assigned Jobs';
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLTableRowElement;
    const actionsButton = row.querySelector('button') as HTMLButtonElement;
    expect(row.textContent).toContain('#12345678');
    expect(row.textContent).toContain('Washing machine');
    expect(row.textContent).toContain('Ava Customer');
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
});
