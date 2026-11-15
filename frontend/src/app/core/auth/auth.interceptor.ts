import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from '../toast/toast.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = new URL(environment.apiBaseUrl, window.location.origin);
  const requestUrl = new URL(request.url, window.location.origin);
  const apiPath = apiUrl.pathname.replace(/\/$/, '');
  const isApiRequest =
    requestUrl.origin === apiUrl.origin &&
    (requestUrl.pathname === apiPath ||
      requestUrl.pathname.startsWith(`${apiPath}/`));

  if (!isApiRequest) {
    return next(request);
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);
  const isPublicAuthRequest =
    requestUrl.pathname.endsWith('/auth/login') ||
    requestUrl.pathname.endsWith('/auth/register') ||
    requestUrl.pathname.endsWith('/auth/logout');
  const isSessionCheck = requestUrl.pathname.endsWith('/users/me');

  const token = authService.getToken();
  const setHeaders: Record<string, string> = {};
  if (token && !request.headers.has('Authorization')) {
    setHeaders['Authorization'] = `Bearer ${token}`;
  }

  return next(request.clone({ withCredentials: true, setHeaders })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          authService.clearSession();
          if (
            !isPublicAuthRequest &&
            !isSessionCheck &&
            router.url !== '/login' &&
            router.url !== '/register'
          ) {
            void router.navigateByUrl('/login');
          }
        } else if (error.status === 0) {
          toastService.error(
            'Connection Error',
            'Unable to reach Fixora server. Please check your internet connection.',
          );
        } else if (error.status >= 500) {
          toastService.error(
            'Server Error',
            error.error?.message || 'The server encountered an unexpected error. Please try again.',
          );
        }
      }
      return throwError(() => error);
    }),
  );
};
