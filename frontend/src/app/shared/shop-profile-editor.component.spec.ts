import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ShopProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { ShopProfileEditorComponent } from './shop-profile-editor.component';

describe('ShopProfileEditorComponent', () => {
  const profile: ShopProfile = {
    shopName: 'Example Repairs',
    businessType: 'Electronics Repair Shop',
    description: 'Repair services',
    yearsOfExperience: 5,
    ownerName: 'Shop Owner',
    email: 'shop@example.com',
    countryCode: '+91',
    mobileNumber: '9876543210',
    address: 'Main Road',
    street: '',
    area: '',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '411001',
    landmark: '',
    services: ['AC Repair'],
    businessAddress: 'Main Road, Pune, Maharashtra, 411001',
    subscriptionPlan: 'Fixroa Shop monthly subscription',
    subscriptionAmountCents: 2900,
    subscriptionCurrency: 'usd',
    paymentStatus: 'paid',
    registrationStatus: 'approved',
    accountLifecycleStatus: 'active',
    submittedAt: null,
    adminApprovalStatus: 'approved',
    declineReason: null,
  };
  const suggestion = {
    label: '10 Main Road, Pune, Maharashtra 411001',
    latitude: 18.52,
    longitude: 73.85,
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
  };
  const updatedProfile = { ...profile, shopName: 'Updated Repairs' };
  const authService = {
    updateMyShopBusinessDetails: jasmine.createSpy().and.returnValue(of(updatedProfile)),
    suggestRegistrationAddresses: jasmine.createSpy().and.returnValue(of([suggestion])),
  };

  beforeEach(async () => {
    authService.updateMyShopBusinessDetails.calls.reset();
    authService.updateMyShopBusinessDetails.and.returnValue(of(updatedProfile));
    authService.suggestRegistrationAddresses.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ShopProfileEditorComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('lets the shop search and save only the business address', fakeAsync(() => {
    const fixture = TestBed.createComponent(ShopProfileEditorComponent);
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'Pune';
    search.dispatchEvent(new Event('input'));
    tick(300);
    fixture.detectChanges();
    expect(authService.suggestRegistrationAddresses).toHaveBeenCalledWith('Pune');
    (fixture.nativeElement.querySelector('.address-suggestion') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      shopName: 'Updated Repairs',
      landmark: 'Near the park',
    });
    const updated = jasmine.createSpy('profileUpdated');
    fixture.componentInstance.profileUpdated.subscribe(updated);
    fixture.componentInstance.saveAddress();
    fixture.detectChanges();

    expect(authService.updateMyShopBusinessDetails).toHaveBeenCalledWith({
      shopName: 'Updated Repairs',
      address: suggestion.label,
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      landmark: 'Near the park',
      location: { latitude: 18.52, longitude: 73.85 },
    });
    expect(updated).toHaveBeenCalledWith(updatedProfile);
    expect(fixture.nativeElement.textContent).toContain(
      'Your shop name and address have been updated.',
    );
    expect(fixture.nativeElement.querySelector('input[formControlName="fullName"]')).toBeNull();
  }));
});
