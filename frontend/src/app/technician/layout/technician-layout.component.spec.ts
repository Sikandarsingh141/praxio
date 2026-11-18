import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { TechnicianLayoutComponent } from './technician-layout.component';

describe('TechnicianLayoutComponent', () => {
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicianLayoutComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('renders the Customer-style header and responsive technician portal navigation', () => {
    authService.login('technician@example.com', 'password').subscribe();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      data: {
        user: {
          id: 'tech-id',
          email: 'technician@example.com',
          firstName: 'Aman',
          lastName: 'Verma',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'technician',
          accountStatus: 'active',
        },
      },
    });

    const fixture = TestBed.createComponent(TechnicianLayoutComponent);
    fixture.detectChanges();

    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/technician/me`)
      .flush({
        data: {
          technician: {
            id: 'tech-id',
            name: 'Aman Verma',
            email: 'technician@example.com',
            employeeId: 'FX-TCH-1001',
            availability: 'available',
            profileImageData: 'data:image/png;base64,abc',
          },
        },
      });

    const notificationReqs = httpTestingController.match(`${environment.apiBaseUrl}/notifications/my`);
    for (const req of notificationReqs) {
      req.flush({ data: { notifications: [{ id: 'n1', isRead: false }] } });
    }

    const unreadReqs = httpTestingController.match(`${environment.apiBaseUrl}/chat/unread-count`);
    for (const req of unreadReqs) {
      req.flush({ data: { unreadCount: 2 } });
    }

    fixture.detectChanges();

    // Verify brand
    const header = fixture.nativeElement.querySelector('.portal-header');
    expect(header).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.portal-brand img')?.getAttribute('alt')).toBe('Fixroa');
    expect(fixture.nativeElement.querySelector('.topbar-note')?.textContent).toContain(
      'TECHNICIAN PORTAL',
    );
    expect(fixture.nativeElement.querySelector('.global-search')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.global-search kbd')?.textContent).toContain(
      'Ctrl + K',
    );
    const menuToggle = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement | null;
    expect(menuToggle?.getAttribute('aria-controls')).toBe('technician-navigation');

    // Verify account name
    const accountName = fixture.nativeElement.querySelector('.account-name');
    expect(accountName?.textContent?.trim()).toBe('Aman Verma');
    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.dropdown-avatar') as HTMLImageElement).src,
    ).toBe('data:image/png;base64,abc');
    expect(fixture.nativeElement.querySelector('.dropdown-user-details')?.textContent).toContain(
      'FX-TCH-1001',
    );
    (fixture.nativeElement.querySelector('.account-menu-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Verify sidebar navigation links
    const navLinks = fixture.nativeElement.querySelectorAll('.portal-sidebar .portal-nav');
    expect(navLinks.length).toBe(7);
    expect(navLinks[0]?.textContent).toContain('Dashboard');
    expect(navLinks[1]?.textContent).toContain('My Assigned Jobs');
    expect((navLinks[1] as HTMLAnchorElement)?.getAttribute('href')).toBe(
      '/technician/assigned-jobs',
    );
    expect(navLinks[2]?.textContent).toContain('Active Jobs');
    expect(navLinks[3]?.textContent).toContain('Completed Jobs');
    expect(navLinks[4]?.textContent).toContain('Issue Resolution');
    expect((navLinks[4] as HTMLAnchorElement)?.getAttribute('href')).toBe(
      '/technician/jobs/disputed-jobs',
    );
    expect(navLinks[5]?.textContent).toContain('Messages');
    expect(navLinks[6]?.textContent).toContain('My Profile');
    expect(fixture.nativeElement.querySelector('.header-account app-notification-center')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.portal-sidebar .portal-logout-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sidebar-support-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.portal-sidebar')?.textContent).not.toContain('Notifications');
    expect(fixture.nativeElement.querySelector('.portal-sidebar')?.textContent).not.toContain('Need Help?');

    // Verify unread badge in Messages
    expect(navLinks[5]?.textContent).toContain('2');

    menuToggle?.click();
    fixture.detectChanges();
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('.portal-sidebar')?.classList.contains('sidebar-open'),
    ).toBeTrue();

    (fixture.nativeElement.querySelector('.mobile-backdrop') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('false');
  });
});
