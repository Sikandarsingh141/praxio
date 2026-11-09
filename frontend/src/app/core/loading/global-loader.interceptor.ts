import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoaderService } from '../../loaders/overlay/local/loader.service';
import { SKIP_GLOBAL_LOADER } from './global-loader.context';

export const globalLoaderInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = new URL(environment.apiBaseUrl, window.location.origin);
  const requestUrl = new URL(request.url, window.location.origin);
  const apiPath = apiUrl.pathname.replace(/\/$/, '');
  const isApiRequest =
    requestUrl.origin === apiUrl.origin &&
    (requestUrl.pathname === apiPath ||
      requestUrl.pathname.startsWith(`${apiPath}/`));

  if (!isApiRequest || request.context.get(SKIP_GLOBAL_LOADER)) {
    return next(request);
  }

  const loader = inject(LoaderService);
  const owner = {};
  loader.showLoader(owner);

  return next(request).pipe(finalize(() => loader.hideLoader(owner)));
};
