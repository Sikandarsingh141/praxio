import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_GLOBAL_LOADER } from '../loading/global-loader.context';
import {
  ApiEnvelope,
  AuthUserData,
  CustomerRegistrationRequest,
  ShopRegistrationRequest,
  ShopRegistrationResult,
  ShopProfile,
  ShopPaymentStatus,
  ShopInvoicePage,
  RegistrationNotification,
  RegistrationAddressSuggestion,
  UserProfile,
  ShopBusinessDetailsUpdate,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userState = signal<UserProfile | null>(null);
  private readonly loginDestinationState = signal<string | null>(null);
  private readonly shopNameState = signal('');
  private currentUserRequest: Observable<UserProfile | null> | null = null;
  readonly currentUser = this.userState.asReadonly();
  readonly loginDestination = this.loginDestinationState.asReadonly();
  readonly shopName = this.shopNameState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  constructor(private readonly http: HttpClient) {}

  register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Observable<UserProfile> {
    return this.http
      .post<ApiEnvelope<AuthUserData>>(`${environment.apiBaseUrl}/auth/register`, {
        firstName,
        lastName,
        email,
        password,
      })
      .pipe(map((response) => response.data.user));
  }

  registerCustomer(input: CustomerRegistrationRequest): Observable<UserProfile> {
    return this.http
      .post<ApiEnvelope<AuthUserData>>(`${environment.apiBaseUrl}/auth/register/customer`, input)
      .pipe(map((response) => response.data.user));
  }

  registerShop(input: ShopRegistrationRequest): Observable<ShopRegistrationResult> {
    return this.http
      .post<ApiEnvelope<ShopRegistrationResult>>(
        `${environment.apiBaseUrl}/auth/register/shop`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  suggestRegistrationAddresses(query: string): Observable<RegistrationAddressSuggestion[]> {
    const params = new HttpParams().set('q', query);
    return this.http
      .get<ApiEnvelope<{ suggestions: RegistrationAddressSuggestion[] }>>(
        `${environment.apiBaseUrl}/auth/addresses`,
        {
          params,
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, true),
        },
      )
      .pipe(map((response) => response.data.suggestions));
  }

  retryShopCheckout(email: string, password: string): Observable<string> {
    return this.http
      .post<ApiEnvelope<{ checkoutUrl: string }>>(
        `${environment.apiBaseUrl}/auth/register/shop/checkout`,
        { email, password },
      )
      .pipe(map((response) => response.data.checkoutUrl));
  }

  createShopCheckout(): Observable<string> {
    return this.http
      .post<ApiEnvelope<{ checkoutUrl: string }>>(`${environment.apiBaseUrl}/payments/checkout`, {})
      .pipe(map((response) => response.data.checkoutUrl));
  }

  getShopPaymentStatus(): Observable<ShopPaymentStatus> {
    return this.http
      .get<ApiEnvelope<{ payment: ShopPaymentStatus }>>(`${environment.apiBaseUrl}/payments/status`)
      .pipe(map((response) => response.data.payment));
  }

  getMyShopInvoices(page = 1, limit = 10): Observable<ShopInvoicePage> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiEnvelope<ShopInvoicePage>>(`${environment.apiBaseUrl}/payments/invoices`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  getMyShopProfile(): Observable<ShopProfile> {
    return this.http
      .get<ApiEnvelope<{ profile: ShopProfile }>>(`${environment.apiBaseUrl}/shops/my-profile`)
      .pipe(
        map((response) => response.data.profile),
        tap((profile) => this.shopNameState.set(profile.shopName)),
      );
  }

  updateMyShopBusinessDetails(updates: ShopBusinessDetailsUpdate): Observable<ShopProfile> {
    return this.http
      .patch<ApiEnvelope<{ profile: ShopProfile }>>(
        `${environment.apiBaseUrl}/shops/my-profile/business-details`,
        updates,
      )
      .pipe(
        map((response) => response.data.profile),
        tap((profile) => {
          this.shopNameState.set(profile.shopName);
          this.userState.update((user) =>
            user
              ? {
                  ...user,
                  firstName: profile.ownerFirstName,
                  lastName: profile.ownerLastName,
                  countryCode: profile.countryCode,
                  mobileNumber: profile.mobileNumber,
                }
              : user,
          );
        }),
      );
  }

  uploadMyShopImage(image: File): Observable<ShopProfile> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http
      .post<ApiEnvelope<{ profile: ShopProfile }>>(
        `${environment.apiBaseUrl}/shops/my-profile-image`,
        formData,
      )
      .pipe(map((response) => response.data.profile));
  }

  updateMyProfile(firstName: string, lastName: string): Observable<UserProfile> {
    return this.http
      .patch<ApiEnvelope<{ user: UserProfile }>>(`${environment.apiBaseUrl}/users/me/profile`, {
        firstName,
        lastName,
      })
      .pipe(
        map((response) => response.data.user),
        tap((user) => this.userState.set(user)),
      );
  }

  uploadMyProfileImage(image: File): Observable<UserProfile> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http
      .post<ApiEnvelope<{ user: UserProfile }>>(
        `${environment.apiBaseUrl}/users/me/profile-image`,
        formData,
      )
      .pipe(
        map((response) => response.data.user),
        tap((user) => this.userState.set(user)),
      );
  }

  changeMyPassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ changed: true }>>(`${environment.apiBaseUrl}/users/me/password`, {
        currentPassword,
        newPassword,
      })
      .pipe(map(() => undefined));
  }

  getShopDashboard(): Observable<{ shopName: string }> {
    return this.http
      .get<ApiEnvelope<{ shopName: string }>>(`${environment.apiBaseUrl}/shops/dashboard`)
      .pipe(
        map((response) => response.data),
        tap((dashboard) => this.shopNameState.set(dashboard.shopName)),
      );
  }

  getMyNotifications(silent = false): Observable<RegistrationNotification[]> {
    return this.http
      .get<ApiEnvelope<{ notifications: RegistrationNotification[] }>>(
        `${environment.apiBaseUrl}/notifications/my`,
        {
          context: new HttpContext().set(SKIP_GLOBAL_LOADER, silent),
        },
      )
      .pipe(map((response) => response.data.notifications));
  }

  registerNotificationToken(token: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<{ registered: true }>>(
        `${environment.apiBaseUrl}/notifications/device-token`,
        { token },
      )
      .pipe(map(() => undefined));
  }

  removeNotificationToken(token: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<{ removed: true }>>(
        `${environment.apiBaseUrl}/notifications/device-token`,
        { body: { token } },
      )
      .pipe(map(() => undefined));
  }

  markNotificationRead(notificationId: string): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ read: true }>>(
        `${environment.apiBaseUrl}/notifications/${encodeURIComponent(notificationId)}/read`,
        {},
      )
      .pipe(map(() => undefined));
  }

  markAllNotificationsRead(): Observable<void> {
    return this.http
      .patch<ApiEnvelope<{ read: true }>>(`${environment.apiBaseUrl}/notifications/read-all`, {})
      .pipe(map(() => undefined));
  }

  confirmShopPayment(sessionId: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<{ paymentStatus: 'paid' }>>(
        `${environment.apiBaseUrl}/payments/stripe/confirm`,
        { sessionId },
      )
      .pipe(map(() => undefined));
  }

  login(email: string, password: string): Observable<UserProfile> {
    return this.http
      .post<ApiEnvelope<AuthUserData>>(`${environment.apiBaseUrl}/auth/login`, { email, password })
      .pipe(
        map((response) => response.data),
        tap(({ user, redirectTo }) => {
          this.userState.set(user);
          this.loginDestinationState.set(
            redirectTo ??
              (user.accountType === 'admin'
                ? '/admin'
                : user.accountType === 'shop'
                  ? (user.shopAuthorization?.destination ?? '/shop')
                  : (user.customerAuthorization?.destination ?? '/customer')),
          );
        }),
        map((response) => response.user),
      );
  }

  loadCurrentUser(silent = false): Observable<UserProfile | null> {
    return this.http
      .get<ApiEnvelope<AuthUserData>>(`${environment.apiBaseUrl}/users/me`, {
        context: new HttpContext().set(SKIP_GLOBAL_LOADER, silent),
      })
      .pipe(
        map((response) => response.data.user),
        tap((user) => this.userState.set(user)),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.clearSession();
            return of(null);
          }
          return throwError(() => error);
        }),
      );
  }

  getCurrentUser(silent = false): Observable<UserProfile | null> {
    const user = this.userState();
    if (user) return of(user);
    if (this.currentUserRequest) return this.currentUserRequest;

    let request: Observable<UserProfile | null>;
    request = this.loadCurrentUser(silent).pipe(
      finalize(() => {
        if (this.currentUserRequest === request) {
          this.currentUserRequest = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.currentUserRequest = request;
    return request;
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/auth/logout`, {})
      .pipe(finalize(() => this.clearSession()));
  }

  clearSession(): void {
    this.userState.set(null);
    this.loginDestinationState.set(null);
    this.currentUserRequest = null;
  }
}
