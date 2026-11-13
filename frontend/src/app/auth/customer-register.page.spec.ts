import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { CustomerRegisterPage } from './customer-register.page';

describe('CustomerRegisterPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerRegisterPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('validates required fields, password rules, matching passwords, and terms', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.form.setValue({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      profileImageData: '',
      password: 'lowercasepassword',
      confirmPassword: 'differentpassword',
      acceptTerms: false,
      enableNotifications: false,
      latitude: null,
      longitude: null,
    });
    page.submit();

    expect(page.form.invalid).toBe(true);
    expect(page.form.hasError('passwordMismatch')).toBe(true);
    expect(page.form.controls.password.invalid).toBe(true);
    expect(page.form.controls.acceptTerms.invalid).toBe(true);
    httpTestingController.expectNone(`${environment.apiBaseUrl}/auth/register/customer`);
  });

  it('sends valid customer registration data and reports success', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.form.setValue({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      profileImageData: '',
      password: 'Abcdef1!',
      confirmPassword: 'Abcdef1!',
      acceptTerms: true,
      enableNotifications: false,
      latitude: null,
      longitude: null,
    });

    page.submit();

    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/auth/register/customer`,
    );
    expect(request.request.body).toEqual({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      password: 'Abcdef1!',
      acceptTerms: true,
    });
    request.flush({
      data: {
        user: {
          id: 'user-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
        },
      },
    });

    expect(page.form.invalid).toBe(true);
    expect(page.successMessage()).toContain('You can now sign in');
  });

  it('submits captured customer coordinates with the registration', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.patchValue({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      password: 'Abcdef1!',
      confirmPassword: 'Abcdef1!',
      acceptTerms: true,
      latitude: 28.6139,
      longitude: 77.209,
    });

    page.submit();
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/auth/register/customer`,
    );
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        latitude: 28.6139,
        longitude: 77.209,
      }),
    );
    request.flush({
      data: {
        user: {
          id: 'user-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
        },
      },
    });
  });

  it('lets customers upload and remove an optional profile photo', async () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(['profile image'], 'customer.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    page.selectProfileImage({ target: input } as unknown as Event);
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 2000;
      const check = () => {
        if (page.profileImageData()) resolve();
        else if (Date.now() >= deadline) reject(new Error('The selected image was not read.'));
        else setTimeout(check, 10);
      };
      check();
    });
    fixture.detectChanges();

    expect(page.profileImageData()).toMatch(/^data:image\/png;base64,/);
    expect(page.form.controls.profileImageData.value).toBe(page.profileImageData());
    expect(page.profileImageError()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('customer.png');

    page.removeProfileImage();
    fixture.detectChanges();
    expect(page.profileImageData()).toBe('');
    expect(page.profileImageName()).toBe('');
    expect(page.form.controls.profileImageData.value).toBe('');
  });

  it('submits a selected profile photo with customer registration', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.patchValue({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      profileImageData: 'data:image/png;base64,YWJj',
      password: 'Abcdef1!',
      confirmPassword: 'Abcdef1!',
      acceptTerms: true,
    });

    page.submit();
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/auth/register/customer`,
    );
    expect(request.request.body.profileImageData).toBe('data:image/png;base64,YWJj');
    request.flush({
      data: {
        user: {
          id: 'user-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
        },
      },
    });
  });

  it('displays API errors without claiming registration succeeded', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    const page = fixture.componentInstance;
    page.form.setValue({
      firstName: 'Customer',
      lastName: 'Example',
      email: 'customer@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      profileImageData: '',
      password: 'Abcdef1!',
      confirmPassword: 'Abcdef1!',
      acceptTerms: true,
      enableNotifications: false,
      latitude: null,
      longitude: null,
    });
    page.submit();

    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/auth/register/customer`)
      .flush(
        { statusCode: 409, message: 'An account already exists' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(page.errorMessage()).toBe('An account already exists');
    expect(page.successMessage()).toBe('');
  });

  it('can show and hide both password fields accessibly', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();

    const passwordInput = fixture.nativeElement.querySelector(
      '#customer-password',
    ) as HTMLInputElement;
    const confirmationInput = fixture.nativeElement.querySelector(
      '#customer-confirm-password',
    ) as HTMLInputElement;

    expect(passwordInput.type).toBe('password');
    expect(confirmationInput.type).toBe('password');

    fixture.nativeElement.querySelector('[aria-label="Show password"]').click();
    fixture.nativeElement.querySelector('[aria-label="Show confirmation password"]').click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');
    expect(confirmationInput.type).toBe('text');
    expect(fixture.nativeElement.querySelector('[aria-label="Hide password"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.password-toggle svg')).toBeTruthy();
  });

  it('requires exactly ten local mobile digits and keeps the country code separate', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    const page = fixture.componentInstance;

    page.form.controls.countryCode.setValue('+1');
    page.form.controls.mobileNumber.setValue('123456789');
    expect(page.form.controls.mobileNumber.invalid).toBe(true);

    page.form.controls.mobileNumber.setValue('1234567890');
    expect(page.form.controls.mobileNumber.valid).toBe(true);
    expect(page.form.controls.countryCode.value).toBe('+1');
  });

  it('renders the customer benefits alongside the complete registration form', () => {
    const fixture = TestBed.createComponent(CustomerRegisterPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.customer-benefits')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.customer-illustration svg')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Find Trusted Shops');
    expect(fixture.nativeElement.querySelector('#customer-first-name')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#customer-last-name')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#customer-mobile')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#customer-password')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#customer-confirm-password')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.icon-field .field-icon').length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.password-field .field-icon').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.location-field .secondary-action')).toBeTruthy();
  });
});
