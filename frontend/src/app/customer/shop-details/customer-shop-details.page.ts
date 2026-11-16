import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ShopSearchResult } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { formatShopAddress } from '../../shared/utils/format-shop-address';
import { ShopResultsMapComponent } from '../shop-finder/components/shop-results-map.component';

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
  readonly logoFailed = signal(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly portal: CustomerPortalService,
  ) {}

  ngOnInit(): void {
    this.loadShop(this.route.snapshot.paramMap.get('id'));
  }

  retryLoad(): void {
    this.loadShop(this.route.snapshot.paramMap.get('id'));
  }

  private loadShop(shopId: string | null): void {
    this.shop.set(null);
    this.error.set('');
    this.logoFailed.set(false);
    this.loading.set(true);
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
        const message = error.error?.message;
        this.error.set(
          typeof message === 'string' && message
            ? message
            : 'Repair shop could not be loaded.',
        );
        this.loading.set(false);
      },
    });
  }

  get phoneHref(): string | null {
    const phone = this.shop()?.phone;
    return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
  }

  get directionsUrl(): string | null {
    const shop = this.shop();
    if (!shop) return null;
    if (shop.location) {
      return `https://www.google.com/maps/dir/?api=1&destination=${shop.location.latitude},${shop.location.longitude}`;
    }
    return this.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.address)}`
      : null;
  }

  get address(): string {
    const shop = this.shop();
    return shop ? formatShopAddress(shop) : '';
  }

  get initial(): string {
    return this.shop()?.shopName.trim().charAt(0).toLocaleUpperCase() || 'S';
  }
}
