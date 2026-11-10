import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';
import { ShopProfile } from '../core/auth/auth.models';
import { LocationMapComponent } from '../shared/location-map.component';
import { ProfileEditorComponent } from '../shared/profile-editor.component';
import { ShopImageEditorComponent } from '../shared/shop-image-editor.component';
import { ShopProfileEditorComponent } from '../shared/shop-profile-editor.component';

@Component({
  selector: 'app-shop-registration-status-page',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    RouterLink,
    LocationMapComponent,
    ProfileEditorComponent,
    ShopImageEditorComponent,
    ShopProfileEditorComponent,
  ],
  template: `
    <section class="shop-profile-page" aria-labelledby="shop-profile-title">
      <header class="profile-heading">
        <div>
          <span class="page-eyebrow">SHOP PARTNER ACCOUNT</span>
          <h1 id="shop-profile-title">Business profile</h1>
          <p>Review your business details, account status, and registered location.</p>
        </div>
        @if (profile(); as details) {
          <span
            class="status-pill"
            [class.approved]="details.adminApprovalStatus === 'approved'"
            [class.declined]="details.adminApprovalStatus === 'declined'"
            [class.suspended]="details.accountLifecycleStatus === 'suspended'"
            [class.inactive]="details.accountLifecycleStatus === 'inactive'"
          >
            {{
              details.accountLifecycleStatus !== 'active'
                ? (details.accountLifecycleStatus | titlecase)
                : details.adminApprovalStatus === 'not_submitted'
                  ? 'Not submitted'
                  : (details.adminApprovalStatus | titlecase)
            }}
          </span>
        }
      </header>

      <div class="profile-content">
        @if (errorMessage()) {
          <p class="feedback error" role="alert">{{ errorMessage() }}</p>
        }
        @if (profile(); as details) {
          <section
            class="status-card"
            [class.status-approved]="details.adminApprovalStatus === 'approved'"
            [class.status-declined]="details.adminApprovalStatus === 'declined'"
            [class.status-suspended]="details.accountLifecycleStatus === 'suspended'"
            [class.status-inactive]="details.accountLifecycleStatus === 'inactive'"
          >
            <div class="status-icon" aria-hidden="true">
              {{
                details.accountLifecycleStatus === 'suspended' ||
                details.accountLifecycleStatus === 'inactive' ||
                details.adminApprovalStatus === 'declined'
                  ? '!'
                  : details.adminApprovalStatus === 'approved'
                    ? '✓'
                    : '…'
              }}
            </div>
            <div class="status-copy">
              @if (details.accountLifecycleStatus === 'suspended') {
                <h2>Account suspended</h2>
                <p>
                  Your account has been suspended by an administrator. You cannot use the Shop
                  Portal while it is suspended. Contact Fixroa support if you need assistance.
                </p>
              } @else if (details.accountLifecycleStatus === 'inactive') {
                <h2>Account inactive</h2>
                <p>
                  Your account is currently inactive. Contact Fixroa support if you need help
                  restoring access.
                </p>
              } @else if (details.adminApprovalStatus === 'approved') {
                <h2>Registration approved</h2>
                <p>Your shop is approved and ready to use the Fixroa Shop Portal.</p>
              } @else if (details.adminApprovalStatus === 'declined') {
                <h2>Registration declined</h2>
                <p>Your registration was declined. Contact support if you need assistance.</p>
                @if (details.declineReason) {
                  <p class="status-detail"><strong>Reason:</strong> {{ details.declineReason }}</p>
                }
              } @else if (details.paymentStatus === 'paid') {
                <h2>Awaiting admin review</h2>
                <p>
                  Payment is complete. Your business profile is being reviewed by the Fixroa team.
                </p>
              } @else {
                <h2>Payment required</h2>
                <p>
                  Your profile is saved. Complete the subscription payment to submit it for review.
                </p>
              }
            </div>
            @if (
              details.accountLifecycleStatus === 'active' &&
              details.paymentStatus !== 'paid' &&
              details.adminApprovalStatus !== 'approved'
            ) {
              <a class="primary-action" routerLink="/shop/payment">Continue to payment</a>
            }
          </section>

          <app-shop-profile-editor [profile]="details" (profileUpdated)="updateProfile($event)" />

          <app-shop-image-editor
            [imageData]="details.shopImageData"
            [shopName]="details.shopName"
            (imageUpdated)="updateShopImage($event)"
          />
          <app-profile-editor />
          <section class="profile-card" aria-labelledby="subscription-title">
            <div class="section-heading">
              <div>
                <span class="section-eyebrow">ACCOUNT</span>
                <h2 id="subscription-title">Subscription & registration</h2>
              </div>
            </div>
            <dl>
              <div>
                <dt>Subscription plan</dt>
                <dd>
                  {{ details.subscriptionPlan }} —
                  {{ formatAmount(details.subscriptionAmountCents, details.subscriptionCurrency) }}
                  / month
                </dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>{{ details.paymentStatus | titlecase }}</dd>
              </div>
              <div>
                <dt>Registration status</dt>
                <dd>{{ details.registrationStatus | titlecase }}</dd>
              </div>
              <div>
                <dt>Submission date</dt>
                <dd>
                  {{
                    details.submittedAt ? (details.submittedAt | date: 'medium') : 'Not submitted'
                  }}
                </dd>
              </div>
              <div>
                <dt>Admin approval status</dt>
                <dd>{{ details.adminApprovalStatus | titlecase }}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{{ details.accountLifecycleStatus | titlecase }}</dd>
              </div>
            </dl>
          </section>
          <app-location-map [location]="details.location" title="Business location" />
        } @else if (loading()) {
          <div class="profile-card loading-state" role="status">Loading your business profile…</div>
        }
      </div>
    </section>
  `,
  styleUrl: './shop-registration-status.page.scss',
})
export class ShopRegistrationStatusPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly profile = signal<ShopProfile | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.authService
      .getMyShopProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to load your Shop profile. Please try again.'),
          ),
      });
  }

  formatAmount(amountCents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  }

  updateShopImage(imageData: string): void {
    this.profile.update((profile) =>
      profile ? { ...profile, shopImageData: imageData } : profile,
    );
  }

  updateProfile(profile: ShopProfile): void {
    this.profile.set(profile);
  }
}
