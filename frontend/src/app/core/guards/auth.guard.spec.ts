import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { SKIP_GLOBAL_LOADER } from '../loading/global-loader.context';
import { authGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class TestPage {}

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class TestLayout {}

describe('authGuard', () => {
  let router: Router;
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    const routes: Routes = [
      {
        path: 'private',
        component: TestPage,
        canActivate: [authGuard],
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'customer/profile',
        component: TestPage,
        canActivate: [authGuard],
        data: { accountType: 'customer', customerAccess: 'profile' },
      },
      {
        path: 'shop',
        component: TestLayout,
        children: [
          {
            path: '',
            component: TestPage,
            canActivate: [authGuard],
            data: { accountType: 'shop', shopAccess: 'portal' },
          },
          {
            path: 'repair-requests',
            component: TestPage,
            canActivate: [authGuard],
            data: { accountType: 'shop', shopAccess: 'portal' },
          },
          {
            path: 'payment',
            component: TestPage,
            canActivate: [authGuard],
            data: { accountType: 'shop', shopAccess: 'payment' },
          },
          {
            path: 'profile',
            component: TestPage,
            canActivate: [authGuard],
            data: { accountType: 'shop', shopAccess: 'profile' },
          },
        ],
      },
      {
        path: 'admin',
        component: TestPage,
        canActivate: [authGuard],
        data: { accountType: 'admin' },
      },
      { path: 'login', component: TestPage },
    ];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    });
    router = TestBed.inject(Router);
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('redirects an unauthenticated visitor to login', async () => {
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/users/me`)
      .flush(
        { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await navigation;

    expect(router.url).toBe('/login');
    expect(authService.currentUser()).toBeNull();
  });

  it('allows navigation after resolving the authenticated profile', async () => {
    const user = {
      id: 'user-id',
      email: 'person@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      accountType: 'customer' as const,
      accountStatus: 'active' as const,
      customerAuthorization: {
        registrationStatus: 'not_found' as const,
        accountStatus: 'active' as const,
        destination: '/customer' as const,
        submittedAt: null,
        reviewedAt: null,
        declineReason: null,
      },
    };
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({ data: { user } });

    await navigation;

    expect(router.url).toBe('/private');
    expect(authService.currentUser()).toEqual(user);
  });

  it('redirects a shop account to its own portal', async () => {
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'shop-id',
          email: 'shop@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'active',
          shopAuthorization: {
            registrationStatus: 'approved',
            paymentStatus: 'paid',
            accountStatus: 'active',
            destination: '/shop',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: '2026-01-02T00:00:00.000Z',
            declineReason: null,
          },
        },
      },
    });
    await navigation;

    expect(router.url).toBe('/shop');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('reuses the authenticated user when navigating between shop pages', async () => {
    const navigation = router.navigateByUrl('/shop');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const profileRequest = httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`);
    expect(profileRequest.request.context.get(SKIP_GLOBAL_LOADER)).toBeTrue();
    profileRequest.flush({
      data: {
        user: {
          id: 'shop-id',
          email: 'shop@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'active',
          shopAuthorization: {
            registrationStatus: 'approved',
            paymentStatus: 'paid',
            accountStatus: 'active',
            destination: '/shop',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: '2026-01-02T00:00:00.000Z',
            declineReason: null,
          },
        },
      },
    });
    await navigation;

    await router.navigateByUrl('/shop/repair-requests');

    expect(router.url).toBe('/shop/repair-requests');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('redirects an admin account away from the customer portal', async () => {
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'admin-id',
          email: 'admin@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'admin',
          accountStatus: 'active',
        },
      },
    });
    await navigation;

    expect(router.url).toBe('/admin');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('does not gate customer access on a registration approval status', async () => {
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'customer-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
          accountLifecycleStatus: 'active',
          customerAuthorization: {
            registrationStatus: 'pending',
            accountStatus: 'active',
            accountLifecycleStatus: 'active',
            destination: '/customer',
            submittedAt: null,
            reviewedAt: null,
            declineReason: null,
          },
        },
      },
    });
    await navigation;
    expect(router.url).toBe('/private');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('surfaces a session-check failure on the login route', async () => {
    const navigation = router.navigateByUrl('/private');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/users/me`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });

    await navigation;

    expect(router.parseUrl(router.url).queryParams['reason']).toBe('session-unavailable');
  });

  it('redirects an unpaid pending shop to its restricted profile', async () => {
    const navigation = router.navigateByUrl('/shop');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'shop-id',
          email: 'shop@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'pending_approval',
          shopAuthorization: {
            registrationStatus: 'pending',
            paymentStatus: 'unpaid',
            accountStatus: 'pending_approval',
            destination: '/shop/profile',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: null,
            declineReason: null,
          },
        },
      },
    });
    await navigation;

    expect(router.url).toBe('/shop/profile');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('allows paid pending shops to access only their registration profile', async () => {
    const navigation = router.navigateByUrl('/shop/profile');
    await new Promise((resolve) => setTimeout(resolve, 0));
    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'shop-id',
          email: 'shop@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'pending_approval',
          shopAuthorization: {
            registrationStatus: 'pending',
            paymentStatus: 'paid',
            accountStatus: 'pending_approval',
            destination: '/shop/profile',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: null,
            declineReason: null,
          },
        },
      },
    });

    await navigation;

    expect(router.url).toBe('/shop/profile');
  });
});
