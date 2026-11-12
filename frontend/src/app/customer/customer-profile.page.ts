import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { LocationMapComponent } from '../shared/location-map.component';
import { ProfileEditorComponent } from '../shared/profile-editor.component';

@Component({
  selector: 'app-customer-profile-page',
  standalone: true,
  imports: [DatePipe, LocationMapComponent, ProfileEditorComponent, TitleCasePipe],
  template: `
    <section class="customer-profile" aria-labelledby="customer-profile-title">
      <header class="page-heading">
        <div>
          @if (editing()) {
            <button class="back-link" type="button" (click)="editing.set(false)">
              <span aria-hidden="true">←</span> My profile <span aria-hidden="true">›</span> Edit
              profile
            </button>
            <h1 id="customer-profile-title">Edit Customer Profile</h1>
            <p>Update your profile photo, name, and password.</p>
          } @else {
            <span class="page-eyebrow">CUSTOMER ACCOUNT</span>
            <h1 id="customer-profile-title">My profile</h1>
            <p>Manage your personal information and account security.</p>
          }
        </div>
      </header>

      @if (authService.currentUser(); as user) {
        @if (
          user.customerAuthorization?.registrationStatus === 'pending' ||
          user.accountStatus === 'pending_approval'
        ) {
          <section class="review-notice" role="status">
            <h2>Account under Admin review</h2>
            <p>
              Your account is being reviewed by the Fixroa Admin team. You can view your profile and
              notifications while the review is in progress. Once the Admin approves your request,
              you will be able to access the full Customer Portal.
            </p>
          </section>
        } @else if (user.customerAuthorization?.registrationStatus === 'declined') {
          <section class="review-notice declined" role="status">
            <h2>Registration declined</h2>
            <p>
              Your registration was declined. You can view your profile and notifications here.
              Please contact Fixroa support if you need assistance.
            </p>
            @if (user.customerAuthorization?.declineReason) {
              <p>
                <strong>Admin's reason:</strong>
                {{ user.customerAuthorization?.declineReason }}
              </p>
            }
          </section>
        } @else if (user.customerAuthorization?.registrationStatus === 'approved') {
          <section class="review-notice approved" role="status">
            <span class="notice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="m12 2 2.2 2 3-.1 1.1 2.8 2.6 1.5-.7 2.9 1.4 2.6-2.2 2-.2 3-2.9 1-1.6 2.6-2.8-.8-2.7 1.3-2-2.3-3-.2-1-2.9-2.5-1.6.8-2.8L2.2 12l2.2-2 .2-3 2.9-1 1.6-2.6 2.9.8Z"
                />
                <path d="m8.5 12.2 2.2 2.2 4.8-5" />
              </svg>
            </span>
            <div>
              <h2>Registration approved</h2>
              <p>Your account is approved. You now have access to the Customer Portal.</p>
            </div>
            <span class="notice-emblem" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M24 4 41 11v12c0 11-7.5 18-17 22C14.5 41 7 34 7 23V11l17-7Z" />
                <path d="m16 24 5.5 5.5L33 18" />
              </svg>
            </span>
          </section>
        }

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
                user.accountLifecycleStatus || user.accountStatus || 'pending_approval' | titlecase
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
            <div class="summary-item">
              <span class="summary-icon" aria-hidden="true">♧</span>
              <div>
                <span>Registration status</span>
                <strong>
                  {{ user.customerAuthorization?.registrationStatus || 'pending' | titlecase }}
                </strong>
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
                        user.accountLifecycleStatus || user.accountStatus || 'pending_approval'
                          | titlecase
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Registration Status</dt>
                    <dd>
                      {{ user.customerAuthorization?.registrationStatus || 'pending' | titlecase }}
                    </dd>
                  </div>
                  <div>
                    <dt>Member Since</dt>
                    <dd>{{ user.createdAt | date: 'mediumDate' }}</dd>
                  </div>
                  <div>
                    <dt>Registration Submitted</dt>
                    <dd>
                      {{
                        user.customerAuthorization?.submittedAt
                          ? (user.customerAuthorization?.submittedAt | date: 'mediumDate')
                          : 'Not submitted'
                      }}
                    </dd>
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
        <p class="notification-hint">
          Your notifications are available from the bell in the page header.
        </p>
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
