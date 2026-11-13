import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { LocationMapComponent } from '../shared/location-map.component';
import { ProfileEditorComponent } from '../shared/profile-editor.component';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

@Component({
  selector: 'app-customer-profile-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    DatePipe,
    LocationMapComponent,
    ProfileEditorComponent,
    TitleCasePipe,
  ],
  template: `
    <section class="customer-profile" aria-labelledby="customer-profile-title">
      <app-admin-page-header>
        @if (editing()) {
          <button adminPageLeading class="back-link" type="button" (click)="editing.set(false)">
            <span aria-hidden="true">←</span> My profile <span aria-hidden="true">›</span> Edit
            profile
          </button>
        }
        @if (editing()) {
          <h1 adminPageTitle class="admin-page-title" id="customer-profile-title">
            Edit Customer Profile
          </h1>
        } @else {
          <h1 adminPageTitle class="admin-page-title" id="customer-profile-title">My profile</h1>
        }
        @if (editing()) {
          <p adminPageDescription class="admin-page-description">
            Update your profile photo, name, and password.
          </p>
        } @else {
          <p adminPageDescription class="admin-page-description">
            Manage your personal information and account security.
          </p>
        }
      </app-admin-page-header>

      @if (authService.currentUser(); as user) {
        <div class="profile-layout">
          <aside class="profile-summary">
            <div class="profile-photo">
              @if (user.profileImageUrl; as imageUrl) {
                <img [src]="imageUrl" [alt]="displayName(user) + ' profile photo'" />
              } @else {
                <span>{{ initials(user.firstName || user.email) }}</span>
              }
            </div>
            <h2>{{ displayName(user) || 'Customer' }}</h2>
            <span class="account-role">Customer</span>
            <span
              class="status-badge"
              [class.status-active]="
                user.accountLifecycleStatus === 'active' || user.accountStatus === 'active'
              "
              [class.status-declined]="user.accountStatus === 'rejected'"
            >
              {{
                user.accountLifecycleStatus || user.accountStatus || 'active' | titlecase
              }}
            </span>
            <div class="summary-divider"></div>
            <div class="summary-item">
              <span class="summary-icon" aria-hidden="true">✉</span>
              <div>
                <span>Email address</span>
                <strong>{{ user.email }}</strong>
              </div>
            </div>
          </aside>

          <main class="profile-details">
            @if (editing()) {
              <app-profile-editor [allowPasswordChange]="true" />
              <div class="actions">
                <button class="cancel-button" type="button" (click)="editing.set(false)">
                  Done
                </button>
              </div>
            } @else {
              <div class="details-toolbar">
                <h2>Account Information</h2>
                <button class="edit-button" type="button" (click)="editing.set(true)">
                  <span aria-hidden="true">✎</span> Edit Profile
                </button>
              </div>
              <section class="details-section" aria-label="Customer account information">
                <h3>Personal Information</h3>
                <dl>
                  <div>
                    <dt>First Name</dt>
                    <dd>{{ user.firstName || 'Not provided' }}</dd>
                  </div>
                  <div>
                    <dt>Last Name</dt>
                    <dd>{{ user.lastName || 'Not provided' }}</dd>
                  </div>
                  <div>
                    <dt>Email Address</dt>
                    <dd>{{ user.email }}</dd>
                  </div>
                  <div>
                    <dt>Phone Number</dt>
                    <dd>
                      {{
                        user.countryCode && user.mobileNumber
                          ? user.countryCode + ' ' + user.mobileNumber
                          : 'Not provided'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Account Role</dt>
                    <dd>Customer</dd>
                  </div>
                  <div>
                    <dt>Account Status</dt>
                    <dd>
                      {{
                        user.accountLifecycleStatus || user.accountStatus || 'active'
                          | titlecase
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Member Since</dt>
                    <dd>{{ user.createdAt | date: 'mediumDate' }}</dd>
                  </div>
                </dl>
              </section>
              <section class="security-section" aria-label="Account security">
                <div>
                  <h3>Password</h3>
                  <p>Keep your account secure by using a strong, unique password.</p>
                </div>
                <button class="secondary-button" type="button" (click)="editing.set(true)">
                  Change Password
                </button>
              </section>
            }
          </main>
        </div>

        @if (user.location) {
          <app-location-map [location]="user.location" title="Customer map location" />
        }
      } @else {
        <p class="loading-state" role="status">Loading your profile…</p>
      }
    </section>
  `,
  styleUrl: './customer-profile.page.scss',
})
export class CustomerProfilePage {
  readonly authService = inject(AuthService);
  readonly editing = signal(false);

  displayName(user: { firstName?: string; lastName?: string }): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  initials(value: string): string {
    return value.trim().slice(0, 1).toUpperCase() || 'C';
  }
}
