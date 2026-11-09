import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { LoginPage } from './login.page';
import { environment } from '../../environments/environment';

describe('LoginPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('renders the login form', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Sign in to your account',
    );
    expect(fixture.nativeElement.querySelector('input[type="email"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Show password"]')).toBeTruthy();
  });

  it('toggles password visibility accessibly', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const passwordInput = fixture.nativeElement.querySelector(
      '#login-password',
    ) as HTMLInputElement;

    expect(passwordInput.type).toBe('password');
    fixture.nativeElement.querySelector('[aria-label="Show password"]').click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');
    expect(fixture.nativeElement.querySelector('[aria-label="Hide password"]')).toBeTruthy();
    fixture.nativeElement.querySelector('[aria-label="Hide password"]').click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('password');
  });

  it('shows API login errors without marking the user authenticated', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.setValue({
      email: 'person@example.com',
      password: 'a-correct-horse-battery',
    });
    page.submit();

    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Email or password is incorrect');
  });

  it('uses the backend-selected Shop payment destination after login', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.form.setValue({
      email: 'shop@example.com',
      password: 'a-correct-horse-battery',
    });

    fixture.componentInstance.submit();
    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
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
        redirectTo: '/shop/payment',
      },
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/shop/payment');
  });
});
