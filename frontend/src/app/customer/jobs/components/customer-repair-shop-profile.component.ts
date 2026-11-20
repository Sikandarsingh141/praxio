import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { ShopSearchResult } from '../../models/customer-portal.models';
import { formatShopAddress } from '../../../shared/utils/format-shop-address';
import { profileImageSource } from '../../../shared/utils/appliance-thumbnail.util';

@Component({
  selector: 'app-customer-repair-shop-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-repair-shop-profile.component.html',
  styleUrl: './customer-repair-shop-profile.component.scss',
})
export class CustomerRepairShopProfileComponent implements OnChanges {
  @Input() shopId: string | null = null;
  @Input() shopName = 'Repair Shop';
  @Input() ownerName = '';
  @Input() fallbackLogoUrl: string | null = null;
  @Input() fallbackAddress = '';
  @Input() profile: ShopSearchResult | null = null;
  @Input() loading = false;
  @Input() error = '';

  readonly failedOwnerPhoto = signal<string | null>(null);
  readonly failedShopLogo = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['shopId']) {
      this.failedOwnerPhoto.set(null);
      this.failedShopLogo.set(null);
    }
  }

  ownerPhotoUrl(): string | null {
    const image = this.profile?.profileImageUrl;
    if (!image || this.failedOwnerPhoto() === image) return null;
    return profileImageSource(image);
  }

  shopLogoUrl(): string | null {
    const image = this.profile?.logoUrl || this.fallbackLogoUrl;
    if (!image || this.failedShopLogo() === image) return null;
    return profileImageSource(image);
  }

  shopInitial(name: string): string {
    return name.trim().charAt(0).toLocaleUpperCase() || 'S';
  }

  shopPhoneHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  formattedAddress(profile: ShopSearchResult): string {
    return formatShopAddress(profile) || this.fallbackAddress || 'Location not available';
  }
}
