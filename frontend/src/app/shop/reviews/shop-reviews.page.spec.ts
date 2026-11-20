import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ShopReviewSummary } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { ShopReviewsPage } from './shop-reviews.page';

describe('ShopReviewsPage pagination', () => {
  it('shows ten reviews per page and resets paging when a filter changes', async () => {
    const summary: ShopReviewSummary = {
      averageRating: 4.5,
      reviewCount: 6,
      distribution: [],
      reviews: Array.from({ length: 11 }, (_, index) => ({
        repairRequestId: `repair-${index}`,
        customerName: `Customer ${index}`,
        ...(index === 10
          ? { customerProfileImageUrl: 'data:image/png;base64,dGVzdA==' }
          : {}),
        overallRating: 5,
        repairQuality: 5,
        communication: 5,
        professionalism: 5,
        timeliness: 5,
        valueForMoney: 5,
        reviewText: '',
        wouldRecommend: true,
        verifiedAt: '2026-03-01T00:00:00.000Z',
        createdAt: new Date(Date.UTC(2026, 2, index + 1)).toISOString(),
      })),
    };
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>('ShopRepairRequestsService', [
      'getReviews',
    ]);
    requests.getReviews.and.returnValue(of(summary));
    await TestBed.configureTestingModule({
      imports: [ShopReviewsPage],
      providers: [{ provide: ShopRepairRequestsService, useValue: requests }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopReviewsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.review-table tbody tr').length).toBe(10);
    expect(fixture.nativeElement.querySelector('.review-table')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.review-table-scroll.table-scroll-indicators'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.review-table-scroll .table-scroll-indicator-right'),
    ).toBeTruthy();
    const pagination = fixture.nativeElement.querySelector(
      '.review-table-card app-pagination nav',
    ) as HTMLElement;
    expect(pagination).toBeTruthy();
    expect(pagination.classList.contains('brand')).toBeTrue();
    expect(
      (fixture.nativeElement.querySelector('img.review-avatar') as HTMLImageElement).src,
    ).toContain('dGVzdA==');

    fixture.componentInstance.goToPage(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.review-table tbody tr').length).toBe(1);

    fixture.componentInstance.changeRatingFilter('4');
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(1);
    expect(fixture.nativeElement.querySelector('app-pagination nav')).toBeNull();
  });
});
