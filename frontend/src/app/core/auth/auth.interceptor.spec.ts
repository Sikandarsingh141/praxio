import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('sends credentials to the configured API origin', () => {
    httpClient.get(`${environment.apiBaseUrl}/users/me`).subscribe();
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/users/me`,
    );

    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: { user: {} } });
  });

  it('does not add credentials to unrelated requests', () => {
    httpClient.get('https://example.test/data').subscribe();
    const request = httpTestingController.expectOne('https://example.test/data');

    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });
});
