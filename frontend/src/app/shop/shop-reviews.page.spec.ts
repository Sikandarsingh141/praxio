import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ShopReviewSummary } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopReviewsPage } from './shop-reviews.page';

describe('ShopReviewsPage pagination', () => {
  it('shows five reviews per page and resets paging when a filter changes', async () => {
    const summary: ShopReviewSummary = {
      averageRating: 4.5,
      reviewCount: 6,
      distribution: [],
      reviews: Array.from({ length: 6 }, (_, index) => ({
        repairRequestId: `repair-${index}`,
        customerName: `Customer ${index}`,
        overallRating: 5,
        repairQuality: 5,
        communication: 5,
        professionalism: 5,
        timeliness: 5,
        valueForMoney: 5,
        reviewText: '',
        wouldRecommend: true,
        verifiedAt: '2026-03-01T00:00:00.000Z',
        createdAt: `2026-03-0${index + 1}T00:00:00.000Z`,
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
    expect(fixture.nativeElement.querySelectorAll('.review-card').length).toBe(5);
    expect(fixture.nativeElement.querySelector('app-pagination nav')).toBeTruthy();

    fixture.componentInstance.goToPage(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.review-card').length).toBe(1);

    fixture.componentInstance.changeRatingFilter('4');
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(1);
    expect(fixture.nativeElement.querySelector('app-pagination nav')).toBeNull();
  });
});
