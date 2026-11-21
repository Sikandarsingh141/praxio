import { Routes } from '@angular/router';
import { LoginPage } from './auth/login/login.page';
import { AccountSelectionPage } from './auth/account-selection/account-selection.page';
import { CustomerRegisterPage } from './auth/register/customer-register.page';
import { ShopRegisterPage } from './auth/register/shop-register.page';
import { ShopPaymentResultPage } from './auth/register/shop-payment-result.page';
import { authGuard } from './core/guards/auth.guard';
import { DashboardPage } from './customer/dashboard/dashboard.page';
import { AuthLayout } from './shared/components/layouts/auth-layout.component';
import { CustomerLayout } from './customer/layout/customer-layout.component';
import { ShopLayout } from './shop/layout/shop-layout.component';
import { AdminLayout } from './admin/layout/admin-layout.component';
import { AdminDashboardPage } from './admin/dashboard/admin-dashboard.page';
import { AdminOverviewPage } from './admin/dashboard/admin-overview.page';
import { AdminUserDetailsPage } from './admin/users/admin-user-details.page';

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
          import('./customer/profile/customer-profile.page').then(
            (module) => module.CustomerProfilePage,
          ),
        data: { accountType: 'customer', customerAccess: 'profile' },
      },
      {
        path: 'shops',
        loadComponent: () =>
          import('./customer/shop-finder/customer-shop-finder.page').then(
            (module) => module.CustomerShopFinderPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'shops/:id',
        loadComponent: () =>
          import('./customer/shop-details/customer-shop-details.page').then(
            (module) => module.CustomerShopDetailsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'repair-requests',
        loadComponent: () =>
          import('./customer/repair-requests/customer-repair-requests.page').then(
            (module) => module.CustomerRepairRequestsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'repair-requests/completed',
        loadComponent: () =>
          import('./customer/repair-requests/customer-repair-requests.page').then(
            (module) => module.CustomerRepairRequestsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', completedOnly: true },
      },
      {
        path: 'jobs/new-jobs',
        loadComponent: () =>
          import('./customer/jobs/new-jobs/listing/customer-new-jobs-listing.page').then(
            (module) => module.CustomerNewJobsListingPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'new' },
      },
      {
        path: 'jobs/new-jobs/:id',
        loadComponent: () =>
          import('./customer/jobs/new-jobs/detail/customer-new-job-detail.page').then(
            (module) => module.CustomerNewJobDetailPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'new' },
      },
      {
        path: 'jobs/pending-jobs',
        loadComponent: () =>
          import('./customer/jobs/pending-jobs/listing/customer-pending-jobs-listing.page').then(
            (module) => module.CustomerPendingJobsListingPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'pending' },
      },
      {
        path: 'jobs/pending-jobs/:id',
        loadComponent: () =>
          import('./customer/jobs/pending-jobs/detail/customer-pending-job-detail.page').then(
            (module) => module.CustomerPendingJobDetailPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'pending' },
      },
      {
        path: 'jobs/active-jobs',
        loadComponent: () =>
          import('./customer/jobs/active-jobs/listing/customer-active-jobs-listing.page').then(
            (module) => module.CustomerActiveJobsListingPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'active' },
      },
      {
        path: 'jobs/active-jobs/:id',
        loadComponent: () =>
          import('./customer/jobs/active-jobs/detail/customer-active-job-detail.page').then(
            (module) => module.CustomerActiveJobDetailPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'active' },
      },
      {
        path: 'jobs/completed-jobs',
        loadComponent: () =>
          import('./customer/jobs/completed-jobs/listing/customer-completed-jobs-listing.page').then(
            (module) => module.CustomerCompletedJobsListingPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'completed' },
      },
      {
        path: 'jobs/completed-jobs/:id',
        loadComponent: () =>
          import('./customer/jobs/completed-jobs/detail/customer-completed-job-detail.page').then(
            (module) => module.CustomerCompletedJobDetailPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'completed' },
      },
      {
        path: 'jobs/disputed-jobs',
        loadComponent: () =>
          import('./customer/jobs/disputed-jobs/listing/customer-disputed-jobs-listing.page').then(
            (module) => module.CustomerDisputedJobsListingPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'disputed' },
      },
      {
        path: 'jobs/disputed-jobs/:id',
        loadComponent: () =>
          import('./customer/jobs/disputed-jobs/detail/customer-disputed-job-detail.page').then(
            (module) => module.CustomerDisputedJobDetailPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal', jobStatus: 'disputed' },
      },
      {
        path: 'repair-requests/:id',
        loadComponent: () =>
          import('./customer/repair-job-details/customer-repair-job.page').then(
            (module) => module.CustomerRepairJobPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes/new/:repairRequestId',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'quotations',
        loadComponent: () =>
          import('./customer/quotations/customer-quotations.page').then(
            (module) => module.CustomerQuotationsPage,
          ),
        data: { accountType: 'customer', customerAccess: 'portal' },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./shared/components/chat-center/chat-center.component').then(
            (module) => module.ChatCenterComponent,
          ),
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
          import('./shop/dashboard/shop-dashboard.page').then((module) => module.ShopDashboardPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./shop/profile/shop-registration-status.page').then(
            (module) => module.ShopRegistrationStatusPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'profile' },
      },
      {
        path: 'payment',
        loadComponent: () =>
          import('./shop/payments/shop-payment.page').then((module) => module.ShopPaymentPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'payment' },
      },
      {
        path: 'repair-requests',
        loadComponent: () =>
          import('./shop/repair-requests/shop-repair-requests.page').then(
            (module) => module.ShopRepairRequestsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'repair-requests/completed',
        loadComponent: () =>
          import('./shop/repair-requests/shop-repair-requests.page').then(
            (module) => module.ShopRepairRequestsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', completedOnly: true },
      },
      {
        path: 'jobs/new-jobs',
        loadComponent: () =>
          import('./shop/jobs/new-jobs/listing/shop-new-jobs-listing.page').then(
            (module) => module.ShopNewJobsListingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'new' },
      },
      {
        path: 'jobs/new-jobs/:id',
        loadComponent: () =>
          import('./shop/repair-job-details/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'new' },
      },
      {
        path: 'jobs/pending-jobs',
        loadComponent: () =>
          import('./shop/jobs/pending-jobs/listing/shop-pending-jobs-listing.page').then(
            (module) => module.ShopPendingJobsListingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'pending' },
      },
      {
        path: 'jobs/pending-jobs/:id',
        loadComponent: () =>
          import('./shop/repair-job-details/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'pending' },
      },
      {
        path: 'jobs/assigned-jobs',
        loadComponent: () =>
          import('./shop/jobs/assigned-jobs/listing/shop-assigned-jobs-listing.page').then(
            (module) => module.ShopAssignedJobsListingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'assigned' },
      },
      {
        path: 'jobs/assigned-jobs/:id',
        loadComponent: () =>
          import('./shop/repair-job-details/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'assigned' },
      },
      {
        path: 'jobs/active-jobs',
        loadComponent: () =>
          import('./shop/jobs/active-jobs/listing/shop-active-jobs-listing.page').then(
            (module) => module.ShopActiveJobsListingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'active' },
      },
      {
        path: 'jobs/active-jobs/:id',
        loadComponent: () =>
          import('./shop/repair-job-details/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'active' },
      },
      {
        path: 'jobs/completed-jobs',
        loadComponent: () =>
          import('./shop/jobs/completed-jobs/listing/shop-completed-jobs-listing.page').then(
            (module) => module.ShopCompletedJobsListingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'completed' },
      },
      {
        path: 'jobs/completed-jobs/:id',
        loadComponent: () =>
          import('./shop/jobs/completed-jobs/detail/shop-completed-job-detail.page').then(
            (module) => module.ShopCompletedJobDetailPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'completed' },
      },
      {
        path: 'jobs/disputed-jobs',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'disputed' },
      },
      {
        path: 'jobs/disputed-jobs/:id',
        loadComponent: () =>
          import('./shop/jobs/disputed-jobs/detail/shop-disputed-job-detail.page').then(
            (module) => module.ShopDisputedJobDetailPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal', jobStatus: 'disputed' },
      },
      {
        path: 'repair-requests/:id',
        loadComponent: () =>
          import('./shop/repair-job-details/shop-repair-request-details.page').then(
            (module) => module.ShopRepairRequestDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'quotations',
        loadComponent: () =>
          import('./shop/quotations/shop-quotations.page').then(
            (module) => module.ShopQuotationsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./shop/invoices/shop-invoices.page').then((module) => module.ShopInvoicesPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'financial-reporting',
        loadComponent: () =>
          import('./shop/financial-reporting/shop-financial-reporting.page').then(
            (module) => module.ShopFinancialReportingPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./shared/components/chat-center/chat-center.component').then(
            (module) => module.ChatCenterComponent,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./shop/reviews/shop-reviews.page').then((module) => module.ShopReviewsPage),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'technicians',
        loadComponent: () =>
          import('./shop/technicians/shop-technicians.page').then(
            (module) => module.ShopTechniciansPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'technicians/new',
        loadComponent: () =>
          import('./shop/technicians/shop-technician-form.page').then(
            (module) => module.ShopTechnicianFormPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'technicians/:id/edit',
        loadComponent: () =>
          import('./shop/technicians/shop-technician-form.page').then(
            (module) => module.ShopTechnicianFormPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'technicians/:id',
        loadComponent: () =>
          import('./shop/technicians/shop-technician-details.page').then(
            (module) => module.ShopTechnicianDetailsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
      {
        path: 'technician-assignments',
        loadComponent: () =>
          import('./shop/technicians/shop-technician-assignments.page').then(
            (module) => module.ShopTechnicianAssignmentsPage,
          ),
        canActivate: [authGuard],
        data: { accountType: 'shop', shopAccess: 'portal' },
      },
    ],
  },
  {
    path: 'technician',
    loadComponent: () =>
      import('./technician/layout/technician-layout.component').then(
        (module) => module.TechnicianLayoutComponent,
      ),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    data: { accountType: 'technician' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./technician/assigned-jobs/shop-technician-portal.page').then(
            (module) => module.ShopTechnicianPortalPage,
          ),
        data: { accountType: 'technician', technicianView: 'dashboard' },
      },
      {
        path: 'jobs',
        loadComponent: () =>
          import('./technician/assigned-jobs/shop-technician-portal.page').then(
            (module) => module.ShopTechnicianPortalPage,
          ),
        data: { accountType: 'technician', technicianView: 'jobs' },
      },
      {
        path: 'jobs/disputed-jobs',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
        data: { accountType: 'technician', technicianView: 'disputed' },
      },
      {
        path: 'jobs/disputed-jobs/:id',
        loadComponent: () =>
          import('./shop-technician/jobs/disputed-jobs/detail/technician-disputed-job-detail.page').then(
            (module) => module.TechnicianDisputedJobDetailPage,
          ),
        data: { accountType: 'technician', technicianView: 'disputed' },
      },
      {
        path: 'jobs/:id',
        loadComponent: () =>
          import('./technician/assigned-jobs/shop-technician-portal.page').then(
            (module) => module.ShopTechnicianPortalPage,
          ),
        data: { accountType: 'technician', technicianView: 'jobs' },
      },
      {
        path: 'active-jobs',
        loadComponent: () =>
          import('./shop-technician/jobs/active-jobs/listing/technician-active-jobs-listing.page').then(
            (module) => module.TechnicianActiveJobsListingPage,
          ),
        data: { accountType: 'technician', technicianView: 'active' },
      },
      {
        path: 'active-jobs/:id',
        loadComponent: () =>
          import('./shop-technician/jobs/active-jobs/detail/technician-active-job-detail.page').then(
            (module) => module.TechnicianActiveJobDetailPage,
          ),
        data: { accountType: 'technician', technicianView: 'active' },
      },
      {
        path: 'completed-jobs',
        loadComponent: () =>
          import('./shop-technician/jobs/completed-jobs/listing/technician-completed-jobs-listing.page').then(
            (module) => module.TechnicianCompletedJobsListingPage,
          ),
        data: { accountType: 'technician', technicianView: 'completed' },
      },
      {
        path: 'completed-jobs/:id',
        loadComponent: () =>
          import('./shop-technician/jobs/completed-jobs/detail/technician-completed-job-detail.page').then(
            (module) => module.TechnicianCompletedJobDetailPage,
          ),
        data: { accountType: 'technician', technicianView: 'completed' },
      },
      {
        path: 'assigned-jobs',
        loadComponent: () =>
          import('./shop-technician/jobs/assigned-jobs/listing/technician-assigned-jobs-listing.page').then(
            (module) => module.TechnicianAssignedJobsListingPage,
          ),
        data: { accountType: 'technician', technicianView: 'jobs' },
      },
      {
        path: 'assigned-jobs/:id',
        loadComponent: () =>
          import('./shop-technician/jobs/assigned-jobs/detail/technician-assigned-job-detail.page').then(
            (module) => module.TechnicianAssignedJobDetailPage,
          ),
        data: { accountType: 'technician', technicianView: 'jobs' },
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./technician/assigned-jobs/shop-technician-portal.page').then(
            (module) => module.ShopTechnicianPortalPage,
          ),
        data: { accountType: 'technician', technicianView: 'history' },
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./shared/components/chat-center/chat-center.component').then(
            (module) => module.ChatCenterComponent,
          ),
        data: { accountType: 'technician' },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./technician/notifications/shop-technician-notifications.page').then(
            (module) => module.ShopTechnicianNotificationsPage,
          ),
        data: { accountType: 'technician' },
      },
      {
        path: 'performance',
        loadComponent: () =>
          import('./technician/profile/shop-technician-account.page').then(
            (module) => module.ShopTechnicianAccountPage,
          ),
        data: { accountType: 'technician', technicianView: 'performance' },
      },
      {
        path: 'availability',
        loadComponent: () =>
          import('./technician/profile/shop-technician-account.page').then(
            (module) => module.ShopTechnicianAccountPage,
          ),
        data: { accountType: 'technician', technicianView: 'availability' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./technician/profile/shop-technician-account.page').then(
            (module) => module.ShopTechnicianAccountPage,
          ),
        data: { accountType: 'technician', technicianView: 'profile' },
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
        path: 'map',
        loadComponent: () =>
          import('./admin/map-view/admin-map-view.page').then((module) => module.AdminMapViewPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./admin/profile/admin-profile.page').then((module) => module.AdminProfilePage),
      },
      {
        path: 'repair-jobs/:id',
        loadComponent: () =>
          import('./admin/repair-job-details/admin-repair-job-details.page').then(
            (module) => module.AdminRepairJobDetailsPage,
          ),
      },
      {
        path: 'repair-jobs',
        loadComponent: () =>
          import('./admin/repair-requests/admin-repair-monitor.page').then(
            (module) => module.AdminRepairMonitorPage,
          ),
      },
      {
        path: 'disputes/:id',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
      },
      {
        path: 'disputes',
        loadComponent: () =>
          import('./shared/components/dispute-center/dispute-center.component').then(
            (module) => module.DisputeCenterComponent,
          ),
      },
      { path: '', component: AdminOverviewPage },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
