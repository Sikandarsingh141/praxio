import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { UserProfile } from './auth.models';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;
  const user: UserProfile = {
    id: 'user-id',
    email: 'person@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('stores the returned profile after successful login', () => {
    service.login(user.email, 'password').subscribe();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ data: { user } });

    expect(service.currentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('fetches paginated shop invoices for the authenticated account', () => {
    let result: unknown;
    service.getMyShopInvoices(2).subscribe((invoices) => (result = invoices));
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/payments/invoices?page=2&limit=10`,
    );
    expect(request.request.method).toBe('GET');
    const page = {
      invoices: [],
      pagination: { page: 2, limit: 5, total: 6, totalPages: 2 },
    };
    request.flush({ data: page });

    expect(result).toEqual(page);
  });

  it('shares an in-flight profile lookup and reuses the loaded user', () => {
    const firstResults: Array<UserProfile | null> = [];
    const secondResults: Array<UserProfile | null> = [];
    service.getCurrentUser().subscribe((profile) => firstResults.push(profile));
    service.getCurrentUser().subscribe((profile) => secondResults.push(profile));

    httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: { user },
    });

    expect(firstResults).toEqual([user]);
    expect(secondResults).toEqual([user]);
    service.getCurrentUser().subscribe((profile) => expect(profile).toEqual(user));
    httpTestingController.expectNone(`${environment.apiBaseUrl}/users/me`);
  });

  it('updates the cached user profile after saving a name', () => {
    service.updateMyProfile('Updated', 'Person').subscribe();
    const request = httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me/profile`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      firstName: 'Updated',
      lastName: 'Person',
    });
    request.flush({ data: { user: { ...user, firstName: 'Updated', lastName: 'Person' } } });

    expect(service.currentUser()?.firstName).toBe('Updated');
    expect(service.currentUser()?.lastName).toBe('Person');
  });

  it('changes the authenticated user password without returning password data', () => {
    service.changeMyPassword('OldPassword1', 'NewPassword2').subscribe();
    const request = httpTestingController.expectOne(`${environment.apiBaseUrl}/users/me/password`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword2',
    });
    request.flush({ data: { changed: true } });
  });

  it('fetches public geocoded suggestions for shop registration', () => {
    let suggestions: unknown;
    service.suggestRegistrationAddresses('Sector 70, Mohali').subscribe((result) => {
      suggestions = result;
    });

    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/auth/addresses?q=Sector%2070,%20Mohali`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        suggestions: [
          {
            label: 'Sector 70, Mohali, Punjab, India',
            latitude: 30.7,
            longitude: 76.7,
            city: 'Mohali',
          },
        ],
      },
    });

    expect(suggestions).toEqual([
      jasmine.objectContaining({
        label: 'Sector 70, Mohali, Punjab, India',
        city: 'Mohali',
      }),
    ]);
  });

  it('uploads profile photos as multipart form data and caches the updated user', () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'profile.png', {
      type: 'image/png',
    });
    service.uploadMyProfileImage(image).subscribe();
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/users/me/profile-image`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect((request.request.body as FormData).get('image')).toBe(image);
    request.flush({
      data: { user: { ...user, profileImageUrl: 'data:image/png;base64,abc' } },
    });

    expect(service.currentUser()?.profileImageUrl).toBe('data:image/png;base64,abc');
  });

  it('uploads shop images and returns the refreshed shop profile', () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'shop.png', {
      type: 'image/png',
    });
    let updatedProfile: unknown;
    service.uploadMyShopImage(image).subscribe((profile) => (updatedProfile = profile));
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/shops/my-profile-image`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect((request.request.body as FormData).get('image')).toBe(image);
    request.flush({
      data: {
        profile: {
          shopName: 'Example Repairs',
          shopImageData: 'data:image/png;base64,abc',
        },
      },
    });

    expect(updatedProfile).toEqual({
      shopName: 'Example Repairs',
      shopImageData: 'data:image/png;base64,abc',
    });
  });

  it('updates only the shop name and address', () => {
    const update = {
      shopName: 'Updated Repairs',
      address: 'Main Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      landmark: '',
      location: null,
    };
    let updatedProfile: unknown;
    service.updateMyShopBusinessDetails(update).subscribe((profile) => (updatedProfile = profile));
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/shops/my-profile/business-details`,
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(update);
    const profile = {
      shopName: 'Updated Repairs',
      ownerFirstName: 'Shop',
      ownerLastName: 'Owner',
      email: user.email,
    };
    request.flush({ data: { profile } });

    expect(updatedProfile).toEqual(profile);
    expect(service.shopName()).toBe('Updated Repairs');
  });

  it('clears local auth state when the logout request fails', () => {
    service.login(user.email, 'password').subscribe();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ data: { user } });

    service.logout().subscribe({ error: () => undefined });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/logout`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('treats an expired session as unauthenticated', () => {
    let result: UserProfile | null | undefined;
    service.loadCurrentUser().subscribe((currentUser) => {
      result = currentUser;
    });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/users/me`)
      .flush(
        { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(result).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
