import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { LoaderService } from '../../loaders/overlay/local/loader.service';
import { SKIP_GLOBAL_LOADER } from './global-loader.context';
import { globalLoaderInterceptor } from './global-loader.interceptor';

describe('globalLoaderInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let loader: jasmine.SpyObj<LoaderService>;

  beforeEach(() => {
    loader = jasmine.createSpyObj<LoaderService>('LoaderService', ['showLoader', 'hideLoader']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([globalLoaderInterceptor])),
        provideHttpClientTesting(),
        { provide: LoaderService, useValue: loader },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('shows and hides the loader for API requests after success', () => {
    http.get(`${environment.apiBaseUrl}/users/me`).subscribe();
    const request = httpTesting.expectOne(`${environment.apiBaseUrl}/users/me`);
    expect(loader.showLoader).toHaveBeenCalledTimes(1);

    request.flush({});
    expect(loader.hideLoader).toHaveBeenCalledWith(loader.showLoader.calls.argsFor(0)[0]);
  });

  it('hides the loader when an API request fails', () => {
    http.get(`${environment.apiBaseUrl}/users/me`).subscribe({ error: () => undefined });
    const request = httpTesting.expectOne(`${environment.apiBaseUrl}/users/me`);
    request.flush({}, { status: 500, statusText: 'Server error' });

    expect(loader.hideLoader).toHaveBeenCalledTimes(1);
  });

  it('tracks concurrent requests independently', () => {
    http.get(`${environment.apiBaseUrl}/users/me`).subscribe();
    http.get(`${environment.apiBaseUrl}/shops/my-profile`).subscribe();
    const first = httpTesting.expectOne(`${environment.apiBaseUrl}/users/me`);
    const second = httpTesting.expectOne(`${environment.apiBaseUrl}/shops/my-profile`);

    expect(loader.showLoader).toHaveBeenCalledTimes(2);
    first.flush({});
    expect(loader.hideLoader).toHaveBeenCalledTimes(1);
    second.flush({});
    expect(loader.hideLoader).toHaveBeenCalledTimes(2);
  });

  it('does not show the loader for explicitly silent or non-API requests', () => {
    http
      .get(`${environment.apiBaseUrl}/notifications/my`, {
        context: new HttpContext().set(SKIP_GLOBAL_LOADER, true),
      })
      .subscribe();
    http.get('https://example.test/data').subscribe();

    httpTesting.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({});
    httpTesting.expectOne('https://example.test/data').flush({});
    expect(loader.showLoader).not.toHaveBeenCalled();
  });
});
