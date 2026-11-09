import { Injectable } from '@angular/core';

export interface ShopRegistrationDraft {
  ownerFullName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  profileImageData?: string;
  shopImageData?: string;
  shopName: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  landmark: string;
  latitude: number | null;
  longitude: number | null;
  services: string[];
}

@Injectable({ providedIn: 'root' })
export class ShopRegistrationDraftService {
  private draft: ShopRegistrationDraft | null = null;

  setDraft(draft: ShopRegistrationDraft): void {
    this.draft = {
      ...draft,
      services: [...draft.services],
    };
  }

  getDraft(): ShopRegistrationDraft | null {
    return this.draft
      ? {
          ...this.draft,
          services: [...this.draft.services],
        }
      : null;
  }

  clearDraft(): void {
    this.draft = null;
  }
}
