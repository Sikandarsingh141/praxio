import { CurrencyPipe, DatePipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getAuthErrorMessage } from '../../core/auth/auth-error-message';
import { LoaderDirective } from '../../core/loading/overlay/local/loader.directive';
import { formatShopAddress } from '../../shared/utils/format-shop-address';
import { LocationMapComponent } from '../../shared/components/maps/location-map.component';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { AdminService, AdminUserActivity, AdminUserDetails } from '../services/admin.service';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';

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
    AdminPageHeaderComponent,
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
  readonly profileImageFailed = signal(false);
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
        this.profileImageFailed.set(false);
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

  profilePhotoSource(user: AdminUserDetails): string | null {
    return this.profileImageFailed() ? null : profileImageSource(user.profileImageUrl);
  }

  onProfilePhotoError(): void {
    this.profileImageFailed.set(true);
  }

  shopAddress(user: AdminUserDetails): string {
    if (!user.shop) {
      return '';
    }

    return formatShopAddress(user.shop);
  }

  scrollToSection(section: 'overview' | 'activity' | 'repair-requests' | 'quotations' | 'payments'): void {
    this.activeSection.set(section);
    document.getElementById(section)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}
