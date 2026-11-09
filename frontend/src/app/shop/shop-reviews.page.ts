import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopReview, ShopReviewSummary } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

@Component({
  selector: 'app-shop-reviews-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shop-reviews.page.html',
  styleUrl: './shop-reviews.page.scss',
})
export class ShopReviewsPage implements OnInit {
  readonly summary = signal<ShopReviewSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly searchText = signal('');
  readonly ratingFilter = signal('all');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly filteredReviews = computed(() => {
    const data = this.summary();
    if (!data) return [];
    const search = this.searchText().trim().toLowerCase();
    return data.reviews
      .filter((review) => {
        const matchesSearch =
          !search ||
          [review.customerName, review.title, review.reviewText, review.liked, review.improvement]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search));
        const matchesRating =
          this.ratingFilter() === 'all' ||
          review.overallRating === Number(this.ratingFilter());
        return matchesSearch && matchesRating;
      })
      .sort((a, b) => {
        const difference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return this.sortOrder() === 'newest' ? -difference : difference;
      });
  });

  constructor(private readonly requests: ShopRepairRequestsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.requests.getReviews().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Shop reviews could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  distributionPercent(count: number): number {
    const total = this.summary()?.reviewCount ?? 0;
    return total ? Math.round((count / total) * 100) : 0;
  }

  reviewInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || 'C';
  }

  reviewStars(rating: number): string {
    return '★'.repeat(Math.max(0, Math.min(5, rating))) +
      '☆'.repeat(Math.max(0, 5 - rating));
  }

  trackReview(_index: number, review: ShopReview): string {
    return review.repairRequestId;
  }
}
