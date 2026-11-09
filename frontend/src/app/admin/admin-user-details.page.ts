import { CurrencyPipe, DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { LoaderDirective } from '../loaders/overlay/local/loader.directive';
import { LocationMapComponent } from '../shared/location-map.component';
import { AdminService, AdminUserActivity, AdminUserDetails } from './admin.service';

@Component({
  selector: 'app-admin-user-details-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    LoaderDirective,
    LocationMapComponent,
    OverlayModule,
    RouterLink,
    TitleCasePipe,
    UpperCasePipe,
  ],
  templateUrl: './admin-user-details.page.html',
  styleUrl: './admin-user-details.page.scss',
})
export class AdminUserDetailsPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  readonly user = signal<AdminUserDetails | null>(null);
  readonly activity = signal<AdminUserActivity[]>([]);
  readonly loading = signal(true);
  readonly activityLoading = signal(true);
  readonly errorMessage = signal('');
  readonly activityErrorMessage = signal('');
  readonly activeSection = signal('overview');
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.errorMessage.set('User profile could not be found.');
      return;
    }

    this.adminService.getUserDetails(id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(getAuthErrorMessage(error, 'Unable to load this user profile.'));
        this.loading.set(false);
      },
    });
    this.adminService.getUserActivity(id).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.activityLoading.set(false);
      },
      error: (error: unknown) => {
        this.activityErrorMessage.set(
          getAuthErrorMessage(error, 'Unable to load administrative activity.'),
        );
        this.activityLoading.set(false);
      },
    });
  }

  shopAddress(user: AdminUserDetails): string {
    if (!user.shop) {
      return '';
    }

    return [
      user.shop.street,
      user.shop.area,
      user.shop.address,
      user.shop.landmark,
      user.shop.city,
      user.shop.state,
      user.shop.postalCode,
      user.shop.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  scrollToSection(section: 'overview' | 'activity' | 'repair-requests' | 'quotations' | 'payments'): void {
    this.activeSection.set(section);
    document.getElementById(section)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}
