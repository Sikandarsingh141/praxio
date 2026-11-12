import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { CustomerLayout } from './customer-layout.component';

@Component({
  standalone: true,
  template: 'Signed out',
})
class LoginStub {}

describe('CustomerLayout', () => {
  let httpTestingController: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: LoginStub },
          { path: 'customer/shops', component: LoginStub },
        ]),
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows customer navigation and supports opening the mobile menu', () => {
    authService.login('person@example.com', 'password').subscribe();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      data: {
        user: {
          id: 'user-id',
          email: 'person@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
          firstName: 'Taylor',
          lastName: 'Example',
          profileImageUrl: 'data:image/png;base64,abc',
          customerAuthorization: {
            registrationStatus: 'approved',
            accountStatus: 'active',
            destination: '/customer',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: '2026-01-02T00:00:00.000Z',
            declineReason: null,
          },
        },
      },
    });
    const fixture = TestBed.createComponent(CustomerLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/chat/unread-count`)
      .flush({ data: { unreadCount: 0 } });

    const logo = fixture.nativeElement.querySelector('.brand-mark img') as HTMLImageElement;
    expect(logo.alt).toBe('Fixroa');
    expect(logo.getAttribute('src')).toBe('/fixroa-logo.png');
    expect(fixture.nativeElement.querySelector('.account-name')?.textContent).toContain(
      'Taylor Example',
    );
    expect((fixture.nativeElement.querySelector('.profile-avatar') as HTMLImageElement).src).toBe(
      'data:image/png;base64,abc',
    );
    expect(fixture.nativeElement.textContent).toContain('Find repair shops');
    expect(fixture.nativeElement.textContent).toContain('My repair requests');
    expect(fixture.nativeElement.textContent).toContain('My quotations');
    const profileLink = fixture.nativeElement.querySelector(
      'a[href="/customer/profile"]',
    ) as HTMLAnchorElement;
    expect(profileLink?.textContent).toContain('My profile');

    const menuButton = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.sidebar').classList).toContain('sidebar-open');
  });

  it('submits the customer header search to shop results with the query', async () => {
    authService.login('person@example.com', 'password').subscribe();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      data: {
        user: {
          id: 'user-id',
          email: 'person@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
          customerAuthorization: {
            registrationStatus: 'approved',
            accountStatus: 'active',
            destination: '/customer',
            submittedAt: null,
            reviewedAt: null,
            declineReason: null,
          },
        },
      },
    });

    const fixture = TestBed.createComponent(CustomerLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/chat/unread-count`)
      .flush({ data: { unreadCount: 0 } });
    const input = fixture.nativeElement.querySelector(
      '.search-placeholder input',
    ) as HTMLInputElement;
    input.value = 'Delhi';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const navigation = firstValueFrom(
      router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1),
      ),
    );

    (fixture.nativeElement.querySelector('.search-placeholder') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await navigation;

    expect(router.url).toBe('/customer/shops?query=Delhi');
  });

  it('clears the authenticated session and returns to login after sign-out', async () => {
    const user = {
      id: 'user-id',
      email: 'person@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    authService.login(user.email, 'password').subscribe();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ data: { user } });

    const fixture = TestBed.createComponent(CustomerLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    expect(fixture.nativeElement.querySelector('.account-name')?.textContent).toContain('Account');

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dropdown-identity')?.textContent).toContain(
      user.email,
    );
    (fixture.nativeElement.querySelector('.sign-out-menu-item') as HTMLButtonElement).click();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/logout`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(router.url).toBe('/login');
    expect(authService.currentUser()).toBeNull();
  });

  it('closes the profile and notification panels on switch or outside click', () => {
    const fixture = TestBed.createComponent(CustomerLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
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
  });
});
