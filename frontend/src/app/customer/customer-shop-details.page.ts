import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ShopSearchResult } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { formatShopAddress } from '../shared/format-shop-address';
import { ShopResultsMapComponent } from './shop-results-map.component';

@Component({
  selector: 'app-customer-shop-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ShopResultsMapComponent],
  templateUrl: './customer-shop-details.page.html',
  styleUrl: './customer-shop-details.page.scss',
})
export class CustomerShopDetailsPage implements OnInit {
  readonly shop = signal<ShopSearchResult | null>(null);
  readonly shopList = computed(() => {
    const shop = this.shop();
    return shop ? [shop] : [];
  });
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly portal: CustomerPortalService,
  ) {}

  ngOnInit(): void {
    const shopId = this.route.snapshot.paramMap.get('id');
    if (!shopId) {
      this.error.set('Repair shop was not found.');
      this.loading.set(false);
      return;
    }
    this.portal.getShop(shopId).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair shop could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  get address(): string {
    const shop = this.shop();
    return shop ? formatShopAddress(shop) : '';
  }
}
