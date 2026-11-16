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

  it('renders technician header, search bar, and portal navigation matching shop portal', () => {
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
          id: 'tech-id',
          name: 'Aman Verma',
          email: 'technician@example.com',
          employeeId: 'FX-TCH-1001',
          availability: 'available',
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
    const brand = fixture.nativeElement.querySelector('.portal-brand');
    expect(brand?.textContent).toContain('TECHNICIAN PORTAL');

    // Verify account name
    const accountName = fixture.nativeElement.querySelector('.account-name');
    expect(accountName?.textContent?.trim()).toBe('Aman Verma');

    // Verify sidebar navigation links
    const navLinks = fixture.nativeElement.querySelectorAll('.portal-sidebar .portal-nav');
    expect(navLinks.length).toBe(8);
    expect(navLinks[0]?.textContent).toContain('Dashboard');
    expect(navLinks[1]?.textContent).toContain('My Assigned Jobs');
    expect(navLinks[2]?.textContent).toContain('Active Jobs');
    expect(navLinks[3]?.textContent).toContain('Completed Jobs');
    expect(navLinks[4]?.textContent).toContain('Messages');
    expect(navLinks[5]?.textContent).toContain('Notifications');
    expect(navLinks[6]?.textContent).toContain('My Profile');
    expect(navLinks[7]?.textContent).toContain('Sign Out');

    // Verify unread badge in Messages
    expect(navLinks[4]?.textContent).toContain('2');
    expect(navLinks[5]?.querySelector('.nav-notification-count')?.textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('.sidebar-support-card')?.textContent).toContain('Get Support');
  });
});
