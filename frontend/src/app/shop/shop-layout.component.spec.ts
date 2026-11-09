import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { ShopLayout } from './shop-layout.component';

describe('ShopLayout', () => {
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopLayout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows the shop identity, portal navigation, and searches existing shop activity', () => {
    authService.login('shop@example.com', 'password').subscribe();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      data: {
        user: {
          id: 'shop-id',
          email: 'shop@example.com',
          fullName: 'Shop Owner',
          profileImageUrl: 'data:image/png;base64,abc',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'shop',
          accountStatus: 'active',
          shopAuthorization: {
            registrationStatus: 'approved',
            paymentStatus: 'paid',
            accountStatus: 'active',
            destination: '/shop',
            submittedAt: null,
            reviewedAt: null,
            declineReason: null,
          },
        },
      },
    });

    const fixture = TestBed.createComponent(ShopLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/shops/dashboard`)
      .flush({ data: { shopName: 'Example Repairs' } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.account-name')?.textContent).toContain(
      'Example Repairs',
    );
    expect((fixture.nativeElement.querySelector('.profile-avatar') as HTMLImageElement).src).toBe(
      'data:image/png;base64,abc',
    );
    expect(fixture.nativeElement.textContent).toContain('Overview');
    expect(fixture.nativeElement.textContent).toContain('Repair requests');
    expect(fixture.nativeElement.textContent).toContain('Quotations');
    expect(fixture.nativeElement.textContent).toContain('Technicians');
    expect(fixture.nativeElement.textContent).toContain('Coming Soon');
    expect(fixture.nativeElement.textContent).toContain('Business profile');
    expect(
      (fixture.nativeElement.querySelector('#shop-global-search') as HTMLInputElement).placeholder,
    ).toBe('Search repair requests, quotations, or customers...');

    const searchInput = fixture.nativeElement.querySelector(
      '#shop-global-search',
    ) as HTMLInputElement;
    searchInput.value = 'washer';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '.global-search button[type="submit"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    httpTestingController
      .expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/shop/repair-requests` &&
          request.params.get('search') === 'washer',
      )
      .flush({
        data: {
          requests: [
            {
              _id: 'req-1',
              appliance: 'Washer',
              customer: { fullName: 'Alex Customer' },
            },
          ],
        },
      });
    httpTestingController
      .expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/shop/quotations` &&
          request.params.get('search') === 'washer',
      )
      .flush({
        data: {
          quotations: [
            {
              _id: 'quotation-1',
              amount: 125,
              currency: 'USD',
              repairRequest: { appliance: 'Washer' },
              customer: { fullName: 'Alex Customer' },
            },
          ],
        },
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Request #REQ-1');
    expect(fixture.nativeElement.textContent).toContain('125 USD');
    expect(
      fixture.nativeElement.querySelectorAll('.global-search-results [role="listitem"]'),
    ).toHaveSize(2);

    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.sign-out-menu-item')?.textContent).toContain(
      'Sign out',
    );
  });

  it('closes the profile menu when notifications open and closes menus outside', () => {
    const fixture = TestBed.createComponent(ShopLayout);
    fixture.detectChanges();
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/notifications/my`)
      .flush({ data: { notifications: [] } });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/shops/dashboard`)
      .flush({ data: { shopName: 'Example Repairs' } });
    fixture.detectChanges();

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

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.account-dropdown')).toBeNull();
  });
});
