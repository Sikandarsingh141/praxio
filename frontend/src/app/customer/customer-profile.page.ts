import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { LocationMapComponent } from '../shared/location-map.component';
import { ProfileEditorComponent } from '../shared/profile-editor.component';

@Component({
  selector: 'app-customer-profile-page',
  standalone: true,
  imports: [DatePipe, LocationMapComponent, ProfileEditorComponent, TitleCasePipe],
  template: `
    <section class="customer-profile" aria-labelledby="customer-profile-title">
      <header class="profile-heading">
        <span class="profile-eyebrow">CUSTOMER ACCOUNT</span>
        <h1 id="customer-profile-title">My profile</h1>
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
                <path d="m12 2 2.2 2 3-.1 1.1 2.8 2.6 1.5-.7 2.9 1.4 2.6-2.2 2-.2 3-2.9 1-1.6 2.6-2.8-.8-2.7 1.3-2-2.3-3-.2-1-2.9-2.5-1.6.8-2.8L2.2 12l2.2-2 .2-3 2.9-1 1.6-2.6 2.9.8Z" />
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

        <app-profile-editor />

        <section class="profile-card" aria-label="Customer profile details">
          <header class="section-heading">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 3h10l4 4v14H5z" />
                <path d="M14 3v5h5M8 12h8M8 16h8" />
              </svg>
            </span>
            <h2>Profile information</h2>
          </header>
          <dl>
            <div>
              <dt>Full name</dt>
              <dd>{{ user.fullName || 'Not provided' }}</dd>
            </div>
            <div>
              <dt>Email address</dt>
              <dd>{{ user.email }}</dd>
            </div>
            <div>
              <dt>Mobile number</dt>
              <dd>
                {{
                  user.countryCode && user.mobileNumber
                    ? user.countryCode + ' ' + user.mobileNumber
                    : 'Not provided'
                }}
              </dd>
            </div>
            <div>
              <dt>Registration status</dt>
              <dd>
                <span
                  class="status-badge"
                  [class.approved-status]="user.customerAuthorization?.registrationStatus === 'approved'"
                >
                  {{ user.customerAuthorization?.registrationStatus ?? 'pending' | titlecase }}
                </span>
              </dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>
                <span class="status-badge" [class.active-status]="user.accountStatus === 'active'">
                  {{ user.accountStatus ?? 'pending_approval' | titlecase }}
                </span>
              </dd>
            </div>
            <div>
              <dt>Submitted on</dt>
              <dd>
                {{
                  user.customerAuthorization?.submittedAt
                    ? (user.customerAuthorization?.submittedAt | date: 'medium')
                    : (user.createdAt | date: 'medium')
                }}
              </dd>
            </div>
          </dl>
        </section>
        <app-location-map [location]="user.location" title="Customer map location" [compact]="true" />
        <p class="notification-hint">
          Your notifications are available from the bell in the page header.
        </p>
      } @else {
        <p role="status">Loading your profile…</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .customer-profile {
      width: min(100%, 1440px);
      margin: 0 auto;
      color: #18221d;
    }

    .profile-heading {
      margin-bottom: 1rem;
    }

    .profile-eyebrow {
      color: #087c3b;
      font-size: 0.68rem;
      font-weight: 750;
      letter-spacing: 0.12em;
    }

    .profile-heading h1 {
      margin: 0.35rem 0 0;
      color: #111915;
      font-size: clamp(1.8rem, 3vw, 2.35rem);
      font-weight: 780;
      letter-spacing: -0.045em;
    }

    .review-notice,
    .profile-card {
      margin-bottom: 1rem;
      padding: clamp(1rem, 2vw, 1.25rem);
      border: 1px solid #e1e6e3;
      border-radius: 0.95rem;
      background: #fff;
      box-shadow: 0 2px 8px rgb(20 40 28 / 5%);
    }

    .review-notice {
      border-color: #c9d9cf;
      background: #f0f7f2;
    }

    .review-notice.declined {
      border-color: #f0c7c7;
      background: #fff5f5;
    }

    .review-notice.approved {
      position: relative;
      display: grid;
      grid-template-columns: 3.2rem minmax(0, 1fr) 4rem;
      align-items: center;
      gap: 1rem;
      overflow: hidden;
      min-height: 5rem;
      border-color: #c6e7ce;
      background: linear-gradient(105deg, #edfff0, #e1f8e6 70%, #d2f2d8);
    }

    .notice-icon,
    .section-icon {
      display: grid;
      width: 3rem;
      height: 3rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 0.75rem;
      background: #d9f6df;
      color: #078132;
    }

    .notice-icon {
      border-radius: 50%;
      background: #bff1ca;
    }

    .notice-icon svg,
    .section-icon svg {
      width: 1.55rem;
      height: 1.55rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .notice-icon svg path:first-child {
      fill: currentColor;
      stroke: none;
    }

    .notice-icon svg path:last-child {
      stroke: #fff;
      stroke-width: 2.2;
    }

    .notice-emblem {
      display: grid;
      place-items: center;
      color: #078132;
    }

    .notice-emblem svg {
      width: 3.8rem;
      height: 3.8rem;
      fill: currentColor;
      stroke: #fff;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.8;
    }

    .review-notice h2,
    .profile-card h2 {
      margin: 0;
      color: #18221d;
      font-size: 1rem;
      font-weight: 760;
    }

    .review-notice:not(.approved) h2 {
      margin-bottom: 0.65rem;
    }

    .review-notice p {
      margin: 0.4rem 0 0;
      color: #43564a;
      font-size: 0.78rem;
      line-height: 1.5;
    }

    .review-notice.approved p {
      margin-top: 0.2rem;
    }

    .profile-card {
      padding: clamp(1rem, 2vw, 1.25rem);
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .section-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.65rem;
    }

    .profile-card dl {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0 1.5rem;
      margin: 0;
    }

    .profile-card dl div {
      min-width: 0;
      padding: 0.7rem 0;
      border-bottom: 1px solid #e8ede9;
    }

    dt {
      color: #526057;
      font-size: 0.75rem;
    }

    dd {
      margin: 0.28rem 0 0;
      overflow-wrap: anywhere;
      color: #141c18;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .status-badge {
      display: inline-flex;
      min-height: 1.6rem;
      align-items: center;
      padding: 0.2rem 0.55rem;
      border-radius: 0.45rem;
      background: #f1f3f1;
      color: #465349;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .approved-status,
    .active-status {
      background: #dcf8e2;
      color: #08752f;
    }

    .notification-hint {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin: 0.9rem 0 0;
      color: #59685f;
      font-size: 0.76rem;
    }

    .notification-hint::before {
      display: grid;
      width: 1.2rem;
      height: 1.2rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 50%;
      background: #e7eeea;
      color: #53675b;
      content: 'i';
      font-size: 0.75rem;
      font-weight: 750;
    }

    @media (max-width: 760px) {
      .profile-card dl {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 520px) {
      .review-notice.approved {
        grid-template-columns: 2.5rem minmax(0, 1fr);
        gap: 0.7rem;
      }

      .notice-icon {
        width: 2.5rem;
        height: 2.5rem;
      }

      .notice-emblem {
        display: none;
      }

      .profile-card dl {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CustomerProfilePage {
  readonly authService = inject(AuthService);
}
