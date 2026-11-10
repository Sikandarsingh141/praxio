import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { AccountSelectionPage } from './auth/account-selection.page';
import { CustomerRegisterPage } from './auth/customer-register.page';
import { ShopRegisterPage } from './auth/shop-register.page';
import { ShopPaymentResultPage } from './auth/shop-payment-result.page';
import { authGuard } from './core/guards/auth.guard';
import { DashboardPage } from './dashboard/dashboard.page';
import { AuthLayout } from './shared/auth-layout.component';
import { CustomerLayout } from './customer/customer-layout.component';
import { ShopLayout } from './shop/shop-layout.component';
import { AdminLayout } from './admin/admin-layout.component';
import { AdminDashboardPage } from './admin/admin-dashboard.page';
import { AdminOverviewPage } from './admin/admin-overview.page';
import { AdminUserDetailsPage } from './admin/admin-user-details.page';

export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', redirectTo: 'auth/login' },
      { path: 'register', redirectTo: 'auth/register' },
      {
        path: 'auth',
        children: [
          { path: 'login', component: LoginPage },
          { path: 'register', component: AccountSelectionPage },
          { path: 'register/customer', component: CustomerRegisterPage },
          {
            path: 'register/shop/payment/success',
            component: ShopPaymentResultPage,
            data: { paymentResult: 'success' },
          },
          {
            path: 'register/shop/payment/cancelled',
            component: ShopPaymentResultPage,
            data: { paymentResult: 'cancelled' },
          },
          { path: 'register/shop', component: ShopRegisterPage },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
    ],
  },
  {
    path: 'dashboard',
    pathMatch: 'full',
    redirectTo: 'customer',
  },
  {
    path: 'customer',
    component: CustomerLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    data: { accountType: 'customer' },
    children: [
      {
        path: '',
        component: DashboardPage,
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./customer/customer-profile.page').then((module) => module.CustomerProfilePage),
        data: { accountType: 'customer', customerAccess: 'profile' },
      },
      {
        path: 'shops',
        loadComponent: () =>
          import('./customer/customer-shop-finder.page').then(
            (module) => module.CustomerShopFinderPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'shops/:id',
        loadComponent: () =>
          import('./customer/customer-shop-details.page').then(
            (module) => module.CustomerShopDetailsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'repair-requests',
        loadComponent: () =>
          import('./customer/customer-repair-requests.page').then(
            (module) => module.CustomerRepairRequestsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'repair-requests/completed',
        loadComponent: () =>
          import('./customer/customer-repair-requests.page').then(
            (module) => module.CustomerRepairRequestsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', completedOnly: true },
      },
      {
        path: 'repair-requests/:id',
        loadComponent: () =>
          import('./customer/customer-repair-job.page').then(
            (module) => module.CustomerRepairJobPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes/new/:repairRequestId',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'quotations',
        loadComponent: () =>
          import('./customer/customer-quotations.page').then(
            (module) => module.CustomerQuotationsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./shared/chat-center.component').then((module) => module.ChatCenterComponent),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
    ],
  },
  {
    path: 'shop',
    component: ShopLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shop/shop-dashboard.page').then((module) => module.ShopDashboardPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./shop/shop-registration-status.page').then(
            (module) => module.ShopRegistrationStatusPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'profile' },
      },
      {
        path: 'payment',
        loadComponent: () =>
          import('./shop/shop-payment.page').then((module) => module.ShopPaymentPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'payment' },
      },
      {
        path: 'repair-requests',
        loadComponent: () =>
          import('./shop/shop-repair-requests.page').then(
            (module) => module.ShopRepairRequestsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'repair-requests/completed',
        loadComponent: () =>
          import('./shop/shop-repair-requests.page').then(
            (module) => module.ShopRepairRequestsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', completedOnly: true },
      },
      {
        path: 'repair-requests/:id',
        loadComponent: () =>
          import('./shop/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'quotations',
        loadComponent: () =>
          import('./shop/shop-quotations.page').then((module) => module.ShopQuotationsPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./shared/chat-center.component').then((module) => module.ChatCenterComponent),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./shop/shop-reviews.page').then((module) => module.ShopReviewsPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
    ],
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard],
    data: { accountType: 'admin' },
    children: [
      { path: 'users/:id', component: AdminUserDetailsPage },
      { path: 'users', component: AdminDashboardPage },
      {
        path: 'repair-jobs/:id',
        loadComponent: () =>
          import('./admin/admin-repair-job-details.page').then(
            (module) => module.AdminRepairJobDetailsPage,
          ),
      },
      {
        path: 'repair-jobs',
        loadComponent: () =>
          import('./admin/admin-repair-monitor.page').then(
            (module) => module.AdminRepairMonitorPage,
          ),
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
      },
      { path: '', component: AdminOverviewPage },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
