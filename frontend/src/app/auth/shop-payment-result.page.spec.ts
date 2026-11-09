import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ShopPaymentResultPage } from './shop-payment-result.page';

describe('ShopPaymentResultPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopPaymentResultPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { paymentResult: 'success' },
              queryParamMap: { get: () => 'cs_test_session' },
            },
          },
        },
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('confirms the completed Checkout session with the backend', () => {
    const fixture = TestBed.createComponent(ShopPaymentResultPage);
    fixture.detectChanges();

    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/payments/stripe/confirm`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ sessionId: 'cs_test_session' });
    request.flush({ data: { paymentStatus: 'paid' } });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/users/me`)
      .flush(
        { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Payment confirmed. Sign in to view your Shop profile and registration status.',
    );
  });
});
