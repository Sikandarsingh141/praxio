import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const profile$ = authService.getCurrentUser(route.data['accountType'] === 'shop');

  return profile$.pipe(
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login']);
      }

      const requiredAccountType = route.data['accountType'];
      const accountType = user.accountType ?? 'customer';
      if (typeof requiredAccountType === 'string' && accountType !== requiredAccountType) {
        const portalPath = {
          customer: '/customer',
          shop: '/shop',
          admin: '/admin',
        }[accountType];
        return router.createUrlTree([portalPath]);
      }

      if (accountType === 'customer') {
        const authorization = user.customerAuthorization;
        const accountIsActive =
          authorization?.accountLifecycleStatus !== undefined
            ? authorization.accountLifecycleStatus === 'active'
            : authorization?.accountStatus === 'active';
        const approved =
          authorization?.registrationStatus === 'approved' &&
          authorization.accountStatus === 'active' &&
          accountIsActive;
        const legacyActive =
          authorization?.registrationStatus === 'not_found' &&
          authorization.accountStatus === 'active' &&
          accountIsActive;
        const profileOnly = !approved && !legacyActive;
        const customerAccess = route.data['customerAccess'];

        if (profileOnly && customerAccess === 'portal') {
          return router.createUrlTree(['/customer/profile']);
        }
        if (!profileOnly && customerAccess === 'profile') {
          return true;
        }
      }

      if (accountType === 'shop') {
        const shopAuthorization = user.shopAuthorization;
        if (!shopAuthorization) {
          return router.createUrlTree(['/login'], {
            queryParams: { reason: 'session-unavailable' },
          });
        }

        const shopAccess = route.data['shopAccess'];
        const accountIsActive =
          shopAuthorization.accountLifecycleStatus !== undefined
            ? shopAuthorization.accountLifecycleStatus === 'active'
            : shopAuthorization.accountStatus === 'active';
        const isApproved =
          shopAuthorization.registrationStatus === 'approved' &&
          shopAuthorization.paymentStatus === 'paid' &&
          shopAuthorization.accountStatus === 'active' &&
          accountIsActive;
        const paymentPending =
          shopAuthorization.registrationStatus === 'pending' &&
          shopAuthorization.paymentStatus !== 'paid';

        if (shopAccess === 'payment') {
          return paymentPending ? true : router.createUrlTree([shopAuthorization.destination]);
        }
        if (shopAccess === 'profile') {
          return true;
        }
        if (!isApproved) {
          return router.createUrlTree([shopAuthorization.destination]);
        }
      }

      return true;
    }),
    catchError(() =>
      of(
        router.createUrlTree(['/login'], {
          queryParams: { reason: 'session-unavailable' },
        }),
      ),
    ),
  );
};
