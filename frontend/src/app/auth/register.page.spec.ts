import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('requires a valid email and a complex password of at least 8 characters', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.setValue({
      firstName: 'Alex',
      lastName: 'Repair',
      email: 'invalid',
      password: 'short',
    });

    page.submit();

    expect(page.form.invalid).toBe(true);
    expect(httpTestingController.match(`${environment.apiBaseUrl}/auth/register`).length).toBe(0);
  });

  it('accepts an 8-character password with uppercase, lowercase, and a number', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.setValue({
      firstName: 'Alex',
      lastName: 'Repair',
      email: 'person@example.com',
      password: 'Abcdef1!',
    });

    expect(page.form.valid).toBe(true);
  });

  it('shows approval-pending success after a successful response', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.setValue({
      firstName: 'Alex',
      lastName: 'Repair',
      email: 'person@example.com',
      password: 'CorrectHorse7Battery',
    });
    page.submit();

    httpTestingController.expectOne(`${environment.apiBaseUrl}/auth/register`).flush({
      data: {
        user: {
          id: 'user-id',
          email: 'person@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Your account is ready. You can now sign in.',
    );
  });
});
