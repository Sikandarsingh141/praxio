import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { CustomerProfilePage } from './customer-profile.page';

describe('CustomerProfilePage', () => {
  const user: UserProfile = {
    id: 'customer-id',
    email: 'customer@example.com',
    firstName: 'Customer',
    lastName: 'Example',
    profileImageUrl: 'data:image/png;base64,Y3VzdG9tZXI=',
    accountType: 'customer',
    accountStatus: 'active',
    accountLifecycleStatus: 'active',
    countryCode: '+1',
    mobileNumber: '1234567890',
    createdAt: '2026-01-01T00:00:00.000Z',
    customerAuthorization: {
      registrationStatus: 'approved',
      accountStatus: 'active',
      destination: '/customer',
      submittedAt: '2026-01-02T00:00:00.000Z',
      reviewedAt: null,
      declineReason: null,
    },
  };

  it('shows customer information and opens name, photo, and password editing', async () => {
    const auth = { currentUser: signal(user) };
    await TestBed.configureTestingModule({
      imports: [CustomerProfilePage],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerProfilePage);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-title')?.textContent,
    ).toContain('My profile');
    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-description')
        ?.textContent,
    ).toContain('Manage your personal information and account security.');
    expect(fixture.nativeElement.textContent).toContain('Customer Example');
    expect(fixture.nativeElement.textContent).toContain('customer@example.com');
    expect(fixture.nativeElement.textContent).not.toContain('Registration status');
    expect(fixture.nativeElement.textContent).not.toContain('Registration approved');
    expect(
      (fixture.nativeElement.querySelector('.profile-photo img') as HTMLImageElement).src,
    ).toContain('Y3VzdG9tZXI=');

    (fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-title')?.textContent,
    ).toContain('Edit Customer Profile');
    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-description')
        ?.textContent,
    ).toContain('Update your profile photo, name, and password.');
    expect(fixture.nativeElement.querySelector('app-profile-editor')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[name="currentPassword"]')).toBeTruthy();
  });
});
