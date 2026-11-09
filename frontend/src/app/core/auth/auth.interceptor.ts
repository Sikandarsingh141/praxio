import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

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
  const isPublicAuthRequest =
    requestUrl.pathname.endsWith('/auth/login') ||
    requestUrl.pathname.endsWith('/auth/register') ||
    requestUrl.pathname.endsWith('/auth/logout');
  const isSessionCheck = requestUrl.pathname.endsWith('/users/me');

  return next(request.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.clearSession();
        if (
          !isPublicAuthRequest &&
          !isSessionCheck &&
          router.url !== '/login' &&
          router.url !== '/register'
        ) {
          void router.navigateByUrl('/login');
        }
      }
      return throwError(() => error);
    }),
  );
};
