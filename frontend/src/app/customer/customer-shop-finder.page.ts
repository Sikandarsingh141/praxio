import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';
import { AddressSuggestion, ShopSearchResult } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { formatShopAddress } from '../shared/format-shop-address';
import { ShopResultsMapComponent } from './shop-results-map.component';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

const SHOP_SERVICES = [
  'AC Repair',
  'Refrigerator Repair',
  'Washing Machine Repair',
  'TV Repair',
  'Mobile Repair',
  'Laptop Repair',
  'Fan Repair',
  'Cooler Repair',
];

@Component({
  selector: 'app-customer-shop-finder',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    ShopResultsMapComponent,
  ],
  templateUrl: './customer-shop-finder.page.html',
  styleUrl: './customer-shop-finder.page.scss',
})
export class CustomerShopFinderPage implements OnInit, OnDestroy {
  @ViewChild('requestPanel') private requestPanel?: ElementRef<HTMLElement>;
  @ViewChild('shopResults') private shopResultsElement?: ElementRef<HTMLElement>;
  @ViewChild(ShopResultsMapComponent) private shopResultsMap?: ShopResultsMapComponent;

  readonly services = SHOP_SERVICES;
  readonly shops = signal<ShopSearchResult[]>([]);
  readonly visibleLimit = signal(10);
  readonly visibleShops = computed(() => this.shops().slice(0, this.visibleLimit()));
  readonly hasMoreShops = computed(() => this.visibleLimit() < this.shops().length);
  readonly shopDirectory = signal<ShopSearchResult[]>([]);
  readonly suggestions = signal<AddressSuggestion[]>([]);
  readonly selectedShops = signal<string[]>([]);
  readonly selectedShopDetails = computed(() => {
    const shopsById = new Map(this.shopDirectory().map((shop) => [shop.id, shop]));
    return this.selectedShops().map((shopId) => ({
      id: shopId,
      shop: shopsById.get(shopId) ?? null,
    }));
  });
  readonly shopSearchText = signal('');
  readonly shopSearchResults = signal<ShopSearchResult[]>([]);
  readonly shopSearchLoading = signal(false);
  readonly shopSearchError = signal('');
  readonly shopPickerMessage = signal('');
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly addressError = signal('');
  readonly requestMessage = signal('');
  readonly requestError = signal('');
  readonly queryText = signal('');
  readonly selectedService = signal('');
  readonly selectedAddress = signal('');
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly maxDistanceKm = signal('');
  readonly minimumRating = signal('');
  readonly sortBy = signal<'nearest' | 'relevant' | 'rating'>('relevant');
  readonly appliance = signal('');
  readonly brand = signal('');
  readonly model = signal('');
  readonly preferredServiceDate = signal('');
  readonly serviceType = signal<'shop_visit' | 'home_service'>('shop_visit');
  readonly description = signal('');
  readonly photos = signal<File[]>([]);
  readonly photoError = signal('');
  readonly addressMenuOpen = signal(false);
  readonly mapCenter = computed(() => {
    const latitude = this.latitude();
    const longitude = this.longitude();
    return latitude === null || longitude === null ? null : { latitude, longitude };
  });

  private readonly addressInput = new Subject<string>();
  private readonly shopSearchInput = new Subject<string>();
  private readonly destroyed = new Subject<void>();
  private searchVersion = 0;

  constructor(
    private readonly portal: CustomerPortalService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.addressInput
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < 3) {
            this.addressError.set('');
            return of([]);
          }
          this.addressError.set('');
          return this.portal.suggestAddresses(query.trim()).pipe(
            catchError(() => {
              this.addressError.set(
                'Address suggestions are unavailable. You can still search by city or postal code.',
              );
              return of([]);
            }),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe((suggestions) => this.suggestions.set(suggestions));
    this.shopSearchInput
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          const normalizedQuery = query.trim();
          this.shopSearchError.set('');
          if (normalizedQuery.length < 2) {
            this.shopSearchLoading.set(false);
            return of({ query: normalizedQuery, shops: [] as ShopSearchResult[] });
          }
          this.shopSearchLoading.set(true);
          return this.portal.searchShops({ query: normalizedQuery, sort: 'relevant' }).pipe(
            map((shops) => ({ query: normalizedQuery, shops })),
            catchError((error: HttpErrorResponse) => {
              this.shopSearchError.set(
                error.error?.message || 'Shop search is unavailable. Please try again.',
              );
              return of({ query: normalizedQuery, shops: [] as ShopSearchResult[] });
            }),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(({ query, shops }) => {
        if (query !== this.shopSearchText().trim()) {
          return;
        }
        this.cacheShops(shops);
        const normalizedQuery = query.toLocaleLowerCase();
        this.shopSearchResults.set(
          normalizedQuery.length < 2
            ? []
            : shops.filter((shop) =>
                shop.shopName.toLocaleLowerCase().includes(normalizedQuery),
              ),
        );
        this.shopSearchLoading.set(false);
      });
    const selectedShop = this.route.snapshot.queryParamMap.get('shop');
    if (selectedShop) {
      this.selectedShops.set([selectedShop]);
    }
    const query = this.route.snapshot.queryParamMap.get('query')?.trim();
    if (query) {
      this.queryText.set(query);
      this.selectedAddress.set(query);
    }
    const service = this.route.snapshot.queryParamMap.get('service');
    if (service && this.services.includes(service)) {
      this.selectedService.set(service);
    }
    this.search();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openRepairRequestForm(): void {
    const panel = this.requestPanel?.nativeElement;
    if (!panel) {
      return;
    }
    panel.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    panel.focus({ preventScroll: true });
  }

  onAddressInput(value: string): void {
    this.selectedAddress.set(value);
    this.queryText.set(value);
    this.sortBy.set('relevant');
    this.latitude.set(null);
    this.longitude.set(null);
    this.addressMenuOpen.set(true);
    this.addressInput.next(value);
  }

  chooseAddress(suggestion: AddressSuggestion): void {
    this.selectedAddress.set(suggestion.label);
    this.queryText.set(suggestion.label);
    this.latitude.set(suggestion.latitude);
    this.longitude.set(suggestion.longitude);
    this.sortBy.set('nearest');
    this.suggestions.set([]);
    this.addressMenuOpen.set(false);
    this.search();
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.addressError.set(
        'This browser does not support location access. Search by city or postal code.',
      );
      return;
    }
    this.addressError.set('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.selectedAddress.set('Current location');
        this.queryText.set('');
        this.latitude.set(coords.latitude);
        this.longitude.set(coords.longitude);
        this.sortBy.set('nearest');
        this.search();
      },
      () =>
        this.addressError.set(
          'Your location could not be read. Allow location access or enter a search area.',
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  search(): void {
    const version = ++this.searchVersion;
    this.visibleLimit.set(10);
    if (this.shopResultsElement) {
      this.shopResultsElement.nativeElement.scrollTop = 0;
    }
    this.loading.set(true);
    this.error.set('');
    const latitude = this.latitude();
    const longitude = this.longitude();
    this.portal
      .searchShops({
        query: this.queryText().trim() || undefined,
        service: this.selectedService() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        maxDistanceKm:
          latitude !== null && longitude !== null && this.maxDistanceKm()
            ? Number(this.maxDistanceKm())
            : undefined,
        minRating: this.minimumRating()
          ? Number(this.minimumRating())
          : undefined,
        sort: this.sortBy(),
      })
      .subscribe({
        next: (shops) => {
          if (version !== this.searchVersion) {
            return;
          }
          this.shops.set(shops);
          this.cacheShops(shops);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (version !== this.searchVersion) {
            return;
          }
          this.error.set(
            error.error?.message || 'We could not load repair shops. Please try again.',
          );
          this.loading.set(false);
        },
      });
  }

  toggleShop(shopId: string): void {
    this.selectedShops.update((selected) => {
      if (selected.includes(shopId)) {
        this.shopPickerMessage.set('');
        return selected.filter((id) => id !== shopId);
      }
      if (selected.length >= 5) {
        this.shopPickerMessage.set('You can add up to 5 shops to a repair request.');
        return selected;
      }
      this.shopPickerMessage.set('');
      return [...selected, shopId];
    });
  }

  onShopSearchInput(query: string): void {
    this.shopSearchText.set(query);
    this.shopSearchError.set('');
    this.shopPickerMessage.set('');
    this.shopSearchResults.set([]);
    this.shopSearchLoading.set(query.trim().length >= 2);
    this.shopSearchInput.next(query);
  }

  addShop(shop: ShopSearchResult): void {
    this.cacheShops([shop]);
    if (this.selectedShops().includes(shop.id)) {
      return;
    }
    this.toggleShop(shop.id);
  }

  removeShop(shopId: string): void {
    this.selectedShops.update((selected) => selected.filter((id) => id !== shopId));
    this.shopPickerMessage.set('');
  }

  private cacheShops(shops: ShopSearchResult[]): void {
    if (!shops.length) {
      return;
    }
    this.shopDirectory.update((current) => {
      const byId = new Map(current.map((shop) => [shop.id, shop]));
      shops.forEach((shop) => byId.set(shop.id, shop));
      return [...byId.values()];
    });
  }

  allVisibleShopsSelected(): boolean {
    const selectableShops = this.visibleShops();
    const selectedVisible = selectableShops.filter((shop) => this.selectedShops().includes(shop.id));
    return selectableShops.length > 0 && selectedVisible.length >= Math.min(5, selectableShops.length);
  }

  toggleVisibleShops(): void {
    const selectableIds = this.visibleShops().map((shop) => shop.id);
    if (this.allVisibleShopsSelected()) {
      this.selectedShops.update((selected) =>
        selected.filter((shopId) => !selectableIds.includes(shopId)),
      );
      this.requestError.set('');
      return;
    }

    this.selectedShops.update((selected) => {
      const retained = selected.filter((shopId) => !selectableIds.includes(shopId));
      const additions = selectableIds.filter((id) => !retained.includes(id));
      const next = [...retained, ...additions.slice(0, Math.max(0, 5 - retained.length))];
      this.requestError.set('');
      return next;
    });
  }

  onShopResultsScroll(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement) || !this.hasMoreShops()) return;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 120) {
      this.visibleLimit.update((limit) => Math.min(limit + 10, this.shops().length));
    }
  }

  onPhotoSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    if (selected.length > 4) {
      this.photoError.set('Choose up to 4 photos.');
      this.photos.set([]);
      return;
    }
    const invalid = selected.find(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024,
    );
    if (invalid) {
      this.photoError.set('Photos must be JPEG, PNG, or WebP and no larger than 1 MB each.');
      this.photos.set([]);
      return;
    }
    this.photoError.set('');
    this.photos.set(selected);
  }

  submitRepairRequest(): void {
    if (!this.selectedShops().length) {
      this.requestError.set('Select at least one repair shop first.');
      return;
    }
    if (!this.appliance().trim() || !this.description().trim()) {
      this.requestError.set('Enter the appliance and describe the problem.');
      return;
    }
    if (this.photoError()) {
      return;
    }
    this.submitting.set(true);
    this.requestError.set('');
    this.requestMessage.set('');
    this.portal
      .createRepairRequest({
        shopIds: this.selectedShops(),
        appliance: this.appliance().trim(),
        description: this.description().trim(),
        photos: this.photos(),
        brand: this.brand().trim() || undefined,
        model: this.model().trim() || undefined,
        preferredServiceDate: this.preferredServiceDate() || undefined,
        serviceType: this.serviceType(),
        customerLatitude: this.latitude() ?? undefined,
        customerLongitude: this.longitude() ?? undefined,
      })
      .subscribe({
        next: (requestId) => {
          this.submitting.set(false);
          void this.router.navigate(['/customer/repair-requests', requestId]);
        },
        error: (error: HttpErrorResponse) => {
          this.requestError.set(
            error.error?.message || 'The repair request could not be submitted.',
          );
          this.submitting.set(false);
        },
      });
  }

  addressFor(shop: ShopSearchResult): string {
    return formatShopAddress(shop);
  }

  focusShopOnMap(shop: ShopSearchResult): void {
    this.shopResultsMap?.focusShop(shop.id);
  }
}
