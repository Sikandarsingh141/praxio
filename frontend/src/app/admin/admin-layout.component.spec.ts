import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { AdminLayout } from './admin-layout.component';

describe('AdminLayout', () => {
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows the full admin name and photo with sign-out in the account dropdown', () => {
    authService.login('admin@example.com', 'password').subscribe();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      data: {
        user: {
          id: 'admin-id',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'Example',
          profileImageUrl: 'data:image/png;base64,abc',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'admin',
          accountStatus: 'active',
        },
      },
    });

    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.account-name')?.textContent).toContain(
      'Admin Example',
    );
    expect((fixture.nativeElement.querySelector('.profile-avatar') as HTMLImageElement).src).toBe(
      'data:image/png;base64,abc',
    );

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dropdown-identity')?.textContent).toContain(
      'admin@example.com',
    );
    expect(fixture.nativeElement.querySelector('.sign-out-menu-item')?.textContent).toContain(
      'Sign out',
    );
  });

  it('closes either header menu when opening the other or clicking outside', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeTruthy();

    (fixture.nativeElement.querySelector('.notification-trigger') as HTMLButtonElement).click();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.notification-panel')).toBeTruthy();

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.notification-panel')).toBeNull();
  });
});
