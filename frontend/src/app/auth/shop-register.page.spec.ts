import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ShopRegisterPage } from './shop-register.page';
import { ShopRegistrationDraftService } from './shop-registration-draft.service';

function waitForImageRead(isLoaded: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 2000;
    const check = () => {
      if (isLoaded()) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error('The selected image was not read.'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

describe('ShopRegisterPage', () => {
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'registerShop',
      'retryShopCheckout',
      'suggestRegistrationAddresses',
    ]);
    authService.suggestRegistrationAddresses.and.returnValue(of([]));
    authService.registerShop.and.returnValue(
      of({
        user: {
          id: 'user-id',
          email: 'owner@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'pending_approval',
        },
        registrationRequest: {
          id: 'registration-id',
          registrationNumber: 'PRX-20260101-ABCDEF',
          registrationStatus: 'pending',
          submittedAt: '2026-01-01T00:00:00.000Z',
        },
        checkoutUrl: 'https://checkout.stripe.test/session',
      }),
    );
    authService.retryShopCheckout.and.returnValue(of('https://checkout.stripe.test/retry'));
    await TestBed.configureTestingModule({
      imports: [ShopRegisterPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('requires valid owner information before advancing', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.next();

    expect(page.currentStep()).toBe(0);
    expect(page.form.controls.ownerFullName.touched).toBe(true);
  });

  it('lets shop owners capture location without manually entering coordinates', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Use my current location');
    expect(fixture.nativeElement.textContent).toContain(
      'Add your shop’s map location so customers and Admins can find it.',
    );
  });

  it('lets shop owners add an optional profile photo', async () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(['profile image'], 'owner.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    page.selectProfileImage({ target: input } as unknown as Event);
    await waitForImageRead(() => Boolean(page.profileImageData()));
    fixture.detectChanges();

    expect(page.profileImageData()).toMatch(/^data:image\/png;base64,/);
    expect(page.form.controls.profileImageData.value).toBe(page.profileImageData());
    expect(page.profileImageError()).toBe('');
    expect(fixture.nativeElement.querySelector('.shop-image-preview')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('owner.png');
  });

  it('lets shop owners add and remove an optional shop image', async () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    const page = fixture.componentInstance;
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(['shop image'], 'shop.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    page.selectShopImage({ target: input } as unknown as Event);
    await waitForImageRead(() => Boolean(page.shopImageData()));
    fixture.detectChanges();

    expect(page.shopImageData()).toMatch(/^data:image\/png;base64,/);
    expect(page.form.controls.shopImageData.value).toBe(page.shopImageData());
    expect(page.shopImageError()).toBe('');
    expect(fixture.nativeElement.querySelector('.shop-image-preview')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('shop.png');

    page.removeShopImage();
    fixture.detectChanges();
    expect(page.shopImageData()).toBe('');
    expect(page.shopImageName()).toBe('');
    expect(page.form.controls.shopImageData.value).toBe('');
  });

  it('shows owner and shop image uploads together in the owner step', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#shop-profile-image')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#shop-image')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#shop-password')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#shop-confirm-password')).not.toBeNull();
  });

  it('uses consistent green icons in owner, business, and location fields', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.icon-field .field-icon').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.password-field .field-icon').length).toBe(2);

    page.currentStep.set(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.icon-field .field-icon').length).toBe(4);

    page.currentStep.set(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.icon-field .field-icon').length).toBe(5);
    expect(
      fixture.nativeElement.querySelector('.address-input-wrapper .field-icon'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.location-field .secondary-action svg'),
    ).not.toBeNull();
  });

  it('rejects shop images larger than 256 KB', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    const page = fixture.componentInstance;
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File([new Uint8Array(256 * 1024 + 1)], 'shop.png', {
      type: 'image/png',
    });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    page.selectShopImage({ target: input } as unknown as Event);

    expect(page.shopImageError()).toContain('up to 256 KB');
    expect(page.shopImageData()).toBe('');
  });

  it('loads shop location suggestions as the shop owner types', async () => {
    authService.suggestRegistrationAddresses.and.returnValues(of([]), of([]));
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(2);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const input = fixture.nativeElement.querySelector('#shop-address-search') as HTMLInputElement;

    input.value = 'Agra, Uttar Pradesh';
    page.onAddressInput(input);
    await new Promise((resolve) => setTimeout(resolve, 375));
    fixture.detectChanges();

    expect(authService.suggestRegistrationAddresses).toHaveBeenCalledWith('Agra, Uttar Pradesh');
    input.value = 'Sector 70, Mohali';
    page.onAddressInput(input);
    await new Promise((resolve) => setTimeout(resolve, 375));
    expect(authService.suggestRegistrationAddresses).toHaveBeenCalledWith('Sector 70, Mohali');
    expect(fixture.nativeElement.textContent).toContain(
      'No address suggestions found. You can continue entering the address manually.',
    );
  });

  it('keeps the address form usable for manual entry if suggestions are unavailable', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(2);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#shop-address-search') as HTMLInputElement;

    input.value = 'Market Road, Agra';
    input.dispatchEvent(new Event('input'));
    const address = fixture.nativeElement.querySelector('#shop-address') as HTMLTextAreaElement;
    address.value = '12 Market Road';
    address.dispatchEvent(new Event('input'));
    fixture.componentInstance.form.patchValue({
      city: 'Agra',
      state: 'Uttar Pradesh',
      postalCode: '282001',
    });

    expect(fixture.componentInstance.addressQuery()).toBe('Market Road, Agra');
    expect(fixture.componentInstance.form.controls.address.value).toBe('12 Market Road');
    expect(fixture.componentInstance.form.controls.address.valid).toBe(true);
    expect(fixture.componentInstance.form.controls.city.value).toBe('Agra');
    expect(fixture.componentInstance.form.controls.state.value).toBe('Uttar Pradesh');
    expect(fixture.componentInstance.form.controls.postalCode.value).toBe('282001');
  });

  it('shows India suggestions and fills/saves the selected address and coordinates', async () => {
    const suggestion = {
      label: 'Plot 12, Airport Road, Sector 70, Mohali, Punjab 160062, India',
      street: 'Plot 12 Airport Road',
      area: 'Sector 70',
      city: 'Mohali',
      state: 'Punjab',
      country: 'India',
      postalCode: '160062',
      latitude: 30.7046,
      longitude: 76.7179,
    };
    authService.suggestRegistrationAddresses.and.returnValue(of([suggestion]));

    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(2);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Search address');
    expect(fixture.nativeElement.textContent).toContain('Address');
    expect(fixture.nativeElement.textContent).not.toContain('Complete address');
    expect(fixture.nativeElement.textContent).not.toContain('Street');
    expect(fixture.nativeElement.textContent).not.toContain('Area / Locality');
    expect(fixture.nativeElement.querySelector('#shop-city')).not.toBeNull();
    const input = fixture.nativeElement.querySelector('#shop-address-search') as HTMLInputElement;

    input.value = 'Sector 70, Mohali';
    page.onAddressInput(input);
    await new Promise((resolve) => setTimeout(resolve, 375));
    fixture.detectChanges();
    expect(page.addressSuggestions().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain(suggestion.label);
    page.selectAddress(suggestion);
    expect(page.form.controls.address.value).toBe(suggestion.label);
    expect(page.form.controls.street.value).toBe('Plot 12 Airport Road');
    expect(page.form.controls.area.value).toBe('Sector 70');
    expect(page.form.controls.city.value).toBe('Mohali');
    expect(page.form.controls.state.value).toBe('Punjab');
    expect(page.form.controls.country.value).toBe('India');
    expect(page.form.controls.postalCode.value).toBe('160062');
    expect(page.form.controls.latitude.value).toBe(30.7046);
    expect(page.form.controls.longitude.value).toBe(76.7179);
    expect(page.addressLookupMessage()).toContain('map coordinates were filled');

    page.form.patchValue({
      ownerFullName: 'Shop Owner',
      email: 'owner@example.com',
      countryCode: '+91',
      mobileNumber: '9876543210',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      shopName: 'Example Repairs',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for household electronics.',
      yearsOfExperience: 5,
      postalCode: '160062',
      services: ['AC Repair'],
    });
    page.currentStep.set(3);
    spyOn(page, 'redirectToCheckout');
    page.submit();

    expect(authService.registerShop).toHaveBeenCalledWith(
      jasmine.objectContaining({
        address: 'Plot 12, Airport Road, Sector 70, Mohali, Punjab 160062, India',
        street: 'Plot 12 Airport Road',
        area: 'Sector 70',
        city: 'Mohali',
        state: 'Punjab',
        country: 'India',
        postalCode: '160062',
        latitude: 30.7046,
        longitude: 76.7179,
      }),
    );
  });

  it('keeps manual location entry available when the geocoder fails', async () => {
    authService.suggestRegistrationAddresses.and.returnValue(
      throwError(() => new Error('Geocoder unavailable')),
    );
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(2);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const input = fixture.nativeElement.querySelector('#shop-address-search') as HTMLInputElement;
    input.value = 'Mohali';
    page.onAddressInput(input);
    await new Promise((resolve) => setTimeout(resolve, 375));

    expect(page.addressLookupMessage()).toContain('temporarily unavailable');
    expect(page.form.controls.address.enabled).toBe(true);
  });

  it('validates each onboarding step without showing an information review page', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    page.form.patchValue({
      ownerFullName: 'Shop Owner',
      email: 'owner@example.com',
      countryCode: '+91',
      mobileNumber: '5551234567',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
    });
    page.next();
    expect(page.currentStep()).toBe(1);

    page.form.patchValue({
      shopName: 'Example Repairs',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for household electronics.',
      yearsOfExperience: 5,
    });
    page.next();
    expect(page.currentStep()).toBe(2);

    page.form.patchValue({
      address: '10 Main Street',
      city: 'Springfield',
      state: 'CA',
      postalCode: '90210',
    });
    page.next();
    expect(page.currentStep()).toBe(3);

    page.form.controls.services.setValue(['AC Repair']);
    page.next();
    fixture.detectChanges();
    expect(page.currentStep()).toBe(3);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(authService.registerShop).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Review your information');
    expect(fixture.nativeElement.textContent).toContain('Create shop account and pay');

    page.goToStep(1);
    expect(page.currentStep()).toBe(1);
  });

  it('does not submit when the service step is invalid', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.currentStep.set(3);
    page.submit();

    expect(authService.registerShop).not.toHaveBeenCalled();
    expect(page.form.controls.services.touched).toBe(true);
  });

  it('shows the active services step and updates selected service cards', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.componentInstance.currentStep.set(3);
    fixture.detectChanges();

    const activeStep = fixture.nativeElement.querySelector('[aria-current="step"]');
    const serviceCards = fixture.nativeElement.querySelectorAll('.service-option');
    const acRepairInput = fixture.nativeElement.querySelector(
      '.service-option input',
    ) as HTMLInputElement;
    const acRepairCard = acRepairInput.closest('.service-option') as HTMLElement;

    expect(activeStep.textContent).toContain('Services');
    expect(serviceCards.length).toBe(8);
    expect(fixture.nativeElement.querySelectorAll('.service-icon svg').length).toBe(8);
    expect(acRepairCard.classList.contains('service-selected')).toBe(false);

    acRepairInput.click();
    fixture.detectChanges();

    expect(acRepairInput.checked).toBe(true);
    expect(acRepairCard.classList.contains('service-selected')).toBe(true);
    expect(fixture.componentInstance.form.controls.services.value).toEqual(['Refrigerator Repair']);
  });

  it('submits the registration directly to secure Checkout from the final step', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    const page = fixture.componentInstance;
    page.form.patchValue({
      ownerFullName: 'Shop Owner',
      email: 'owner@example.com',
      countryCode: '+91',
      mobileNumber: '5551234567',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      shopImageData: 'data:image/png;base64,c2hvcA==',
      shopName: 'Example Repairs',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for household electronics.',
      yearsOfExperience: 5,
      address: '10 Main Street',
      city: 'Springfield',
      state: 'CA',
      postalCode: '90210',
      landmark: '',
      latitude: 28.6139,
      longitude: 77.209,
      services: ['AC Repair'],
    });
    page.currentStep.set(3);
    spyOn(page, 'redirectToCheckout');

    page.submit();

    expect(authService.registerShop).toHaveBeenCalledWith(
      jasmine.objectContaining({
        email: 'owner@example.com',
        shopImageData: 'data:image/png;base64,c2hvcA==',
        shopName: 'Example Repairs',
        latitude: 28.6139,
        longitude: 77.209,
        services: ['AC Repair'],
      }),
    );
    expect('confirmPassword' in authService.registerShop.calls.mostRecent().args[0]).toBe(false);
    expect(TestBed.inject(ShopRegistrationDraftService).getDraft()).toBeNull();
    expect(page.redirectToCheckout).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('can resume Checkout when registration was saved but the first request failed', () => {
    authService.registerShop.and.returnValue(throwError(() => new Error('Checkout unavailable')));
    const fixture = TestBed.createComponent(ShopRegisterPage);
    const page = fixture.componentInstance;
    page.form.patchValue({
      ownerFullName: 'Shop Owner',
      email: 'owner@example.com',
      countryCode: '+91',
      mobileNumber: '5551234567',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      shopName: 'Example Repairs',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for household electronics.',
      yearsOfExperience: 5,
      address: '10 Main Street',
      city: 'Springfield',
      state: 'CA',
      postalCode: '90210',
      landmark: '',
      services: ['AC Repair'],
    });
    page.currentStep.set(3);
    spyOn(page, 'redirectToCheckout');

    page.submit();
    expect(page.errorMessage()).toContain('Unable to submit');
    page.retryPayment();

    expect(authService.retryShopCheckout).toHaveBeenCalledWith(
      'owner@example.com',
      'StrongPassword123',
    );
    expect(page.redirectToCheckout).toHaveBeenCalledWith('https://checkout.stripe.test/retry');
  });

  it('requires a country calling code, ten mobile digits, and provides password eye controls', () => {
    const fixture = TestBed.createComponent(ShopRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    expect(page.form.controls.mobileNumber.invalid).toBe(true);
    page.form.controls.mobileNumber.setValue('9876543210');
    expect(page.form.controls.mobileNumber.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('#shop-country-code')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.password-toggle svg').length).toBe(2);
  });
});
