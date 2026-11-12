import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { AdminProfilePage } from './admin-profile.page';

describe('AdminProfilePage', () => {
  const user: UserProfile = {
    id: 'admin-id',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'Example',
    profileImageUrl: 'data:image/png;base64,YWRtaW4=',
    accountType: 'admin',
    accountStatus: 'active',
    accountLifecycleStatus: 'active',
    countryCode: '+1',
    mobileNumber: '1234567890',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('shows admin account details and opens profile and password editing', async () => {
    const auth = { currentUser: signal(user) };
    await TestBed.configureTestingModule({
      imports: [AdminProfilePage],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminProfilePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Admin Example');
    expect(fixture.nativeElement.textContent).toContain('admin@example.com');
    expect(fixture.nativeElement.textContent).toContain('Administrator');
    expect(
      (fixture.nativeElement.querySelector('.profile-photo img') as HTMLImageElement).src,
    ).toContain('YWRtaW4=');

    (fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-profile-editor')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[name="currentPassword"]')).toBeTruthy();
  });
});
