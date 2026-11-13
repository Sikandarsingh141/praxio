import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
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
import { ShopReviewSummary } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopInvoice, ShopInvoicePage } from '../core/auth/auth.models';
import { PaginationComponent } from '../shared/pagination.component';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

@Component({
  selector: 'app-shop-registration-status-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    LocationMapComponent,
    ProfileEditorComponent,
    ShopImageEditorComponent,
    ShopProfileEditorComponent,
    PaginationComponent,
  ],
  template: `
    <section class="shop-profile-page" aria-labelledby="shop-profile-title">
      <app-admin-page-header>
        @if (editingProfile()) {
          <button adminPageLeading class="profile-back-link" type="button" (click)="editingProfile.set(false)">
            <span aria-hidden="true">←</span> Business profile <span aria-hidden="true">›</span>
            Edit profile
          </button>
        }
        @if (editingProfile()) {
          <h1 adminPageTitle class="admin-page-title" id="shop-profile-title">
            Edit Business Profile
          </h1>
        } @else {
          <h1 adminPageTitle class="admin-page-title" id="shop-profile-title">Business profile</h1>
        }
        @if (editingProfile()) {
          <p adminPageDescription class="admin-page-description">
            Update your shop details, contact information, and business address.
          </p>
        } @else {
          <p adminPageDescription class="admin-page-description">
            Review your business details, account status, and registered location.
          </p>
        }
      </app-admin-page-header>

      <div class="profile-content">
        @if (errorMessage()) {
          <p class="feedback error" role="alert">{{ errorMessage() }}</p>
        }
        @if (profile(); as details) {
          <div class="profile-layout">
            <aside class="profile-summary-card">
              <div class="shop-avatar">
                @if (authService.currentUser()?.profileImageUrl; as image) {
                  <img [src]="image" [alt]="displayOwnerName(details) + ' profile photo'" />
                } @else {
                  <span>{{ initials(details.ownerFirstName) }}</span>
                }
              </div>
              <h2>{{ details.shopName }}</h2>
              <span class="summary-label">Shop partner account</span>
              <span
                class="status-pill"
                [class.approved]="details.adminApprovalStatus === 'approved'"
                [class.declined]="details.adminApprovalStatus === 'declined'"
                [class.suspended]="details.accountLifecycleStatus === 'suspended'"
                [class.inactive]="details.accountLifecycleStatus === 'inactive'"
              >
                {{ accountStatus(details) }}
              </span>

              <div class="rating-summary" aria-label="Customer rating">
                @if (reviewSummary(); as reviews) {
                  @if (reviews.reviewCount > 0 && reviews.averageRating !== null) {
                    <div class="rating-stars" aria-hidden="true">
                      {{ ratingStars(reviews.averageRating) }}
                    </div>
                    <strong>{{ reviews.averageRating | number: '1.1-1' }} Rating</strong>
                    <span>{{ reviews.reviewCount }} Reviews</span>
                  } @else {
                    <span>No customer reviews yet</span>
                  }
                } @else if (reviewError()) {
                  <span class="rating-error" role="status">{{ reviewError() }}</span>
                } @else {
                  <span role="status">Loading rating…</span>
                }
              </div>

              <div class="summary-details">
                <div class="summary-item">
                  <span class="summary-icon" aria-hidden="true">♙</span>
                  <div>
                    <span>Subscription</span>
                    <strong>{{ details.subscriptionPlan }}</strong>
                    <small>
                      {{
                        formatAmount(details.subscriptionAmountCents, details.subscriptionCurrency)
                      }}
                      / month
                    </small>
                  </div>
                </div>
                <div class="summary-item">
                  <span class="summary-icon" aria-hidden="true">▣</span>
                  <div>
                    <span>Payment status</span>
                    <strong>{{ details.paymentStatus | titlecase }}</strong>
                    <small>{{ details.adminApprovalStatus | titlecase }} account</small>
                  </div>
                </div>
                <div class="summary-item">
                  <span class="summary-icon" aria-hidden="true">⌂</span>
                  <div>
                    <span>Registered on</span>
                    <strong>
                      {{
                        details.submittedAt
                          ? (details.submittedAt | date: 'medium')
                          : 'Not submitted'
                      }}
                    </strong>
                  </div>
                </div>
              </div>
            </aside>

            <main class="profile-details-card">
              @if (editingProfile()) {
                <app-shop-profile-editor
                  [profile]="details"
                  (profileUpdated)="updateProfile($event)"
                  (editCancelled)="editingProfile.set(false)"
                />
                <app-shop-image-editor
                  [imageData]="details.shopImageData"
                  [shopName]="details.shopName"
                  (imageUpdated)="updateShopImage($event)"
                />
              } @else {
                <div class="details-toolbar">
                  <div class="profile-tabs" role="tablist" aria-label="Business profile sections">
                    <button
                      type="button"
                      role="tab"
                      [attr.aria-selected]="activeTab() === 'company'"
                      [class.active]="activeTab() === 'company'"
                      (click)="activeTab.set('company')"
                    >
                      Company Information
                    </button>
                    <button
                      type="button"
                      role="tab"
                      [attr.aria-selected]="activeTab() === 'subscription'"
                      [class.active]="activeTab() === 'subscription'"
                      (click)="activeTab.set('subscription')"
                    >
                      Subscription &amp; Payment
                    </button>
                  </div>
                  <button
                    class="edit-profile-button"
                    type="button"
                    (click)="editingProfile.set(true)"
                  >
                    <span aria-hidden="true">✎</span> Edit Profile
                  </button>
                </div>

                @if (
                  details.accountLifecycleStatus !== 'active' ||
                  details.adminApprovalStatus === 'declined' ||
                  details.adminApprovalStatus === 'pending' ||
                  details.adminApprovalStatus === 'not_submitted'
                ) {
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
                          : '…'
                      }}
                    </div>
                    <div class="status-copy">
                      @if (details.accountLifecycleStatus === 'suspended') {
                        <h2>Account suspended</h2>
                        <p>
                          Your account is suspended. Contact Fixroa support if you need assistance.
                        </p>
                      } @else if (details.accountLifecycleStatus === 'inactive') {
                        <h2>Account inactive</h2>
                        <p>Contact Fixroa support if you need help restoring access.</p>
                      } @else if (details.adminApprovalStatus === 'declined') {
                        <h2>Registration declined</h2>
                        <p>
                          Your registration was declined. Contact support if you need assistance.
                        </p>
                        @if (details.declineReason) {
                          <p class="status-detail">
                            <strong>Reason:</strong> {{ details.declineReason }}
                          </p>
                        }
                      } @else if (details.paymentStatus === 'paid') {
                        <h2>Awaiting admin review</h2>
                        <p>Payment is complete. Your business profile is being reviewed.</p>
                      } @else {
                        <h2>Payment required</h2>
                        <p>Complete the subscription payment to submit your profile for review.</p>
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
                }

                @if (activeTab() === 'company') {
                  <section class="tab-panel" role="tabpanel" aria-label="Company information">
                    <div class="detail-section">
                      <h2 class="detail-section-heading">
                        <span aria-hidden="true">▤</span> Company Information
                      </h2>
                      <dl class="detail-grid">
                        <div>
                          <dt>Company Name</dt>
                          <dd>{{ details.shopName }}</dd>
                        </div>
                        <div>
                          <dt>First Name</dt>
                          <dd>{{ details.ownerFirstName }}</dd>
                        </div>
                        <div>
                          <dt>Last Name</dt>
                          <dd>{{ details.ownerLastName }}</dd>
                        </div>
                        <div>
                          <dt>Email Address</dt>
                          <dd>{{ details.email }}</dd>
                        </div>
                        <div>
                          <dt>Phone Number</dt>
                          <dd>
                            {{ details.countryCode }} {{ details.mobileNumber || 'Not provided' }}
                          </dd>
                        </div>
                        <div>
                          <dt>Business Type</dt>
                          <dd>{{ details.businessType || 'Not provided' }}</dd>
                        </div>
                        <div>
                          <dt>Experience</dt>
                          <dd>
                            {{ details.yearsOfExperience }}
                            {{ details.yearsOfExperience === 1 ? 'year' : 'years' }}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div class="detail-section">
                      <h2 class="detail-section-heading">
                        <span aria-hidden="true">⌖</span> Business Address
                      </h2>
                      <dl class="detail-grid">
                        <div>
                          <dt>Address</dt>
                          <dd>
                            {{ details.address || details.businessAddress || 'Not provided' }}
                          </dd>
                        </div>
                        <div>
                          <dt>City</dt>
                          <dd>{{ details.city || 'Not provided' }}</dd>
                        </div>
                        <div>
                          <dt>State</dt>
                          <dd>{{ details.state || 'Not provided' }}</dd>
                        </div>
                        <div>
                          <dt>Country</dt>
                          <dd>{{ details.country || 'Not provided' }}</dd>
                        </div>
                        <div>
                          <dt>Zip Code</dt>
                          <dd>{{ details.postalCode || 'Not provided' }}</dd>
                        </div>
                        @if (details.landmark) {
                          <div>
                            <dt>Landmark</dt>
                            <dd>{{ details.landmark }}</dd>
                          </div>
                        }
                      </dl>
                      @if (details.location) {
                        <app-location-map [location]="details.location" title="Business location" />
                      }
                    </div>

                    <div class="detail-section">
                      <h2 class="detail-section-heading">
                        <span aria-hidden="true">▣</span> Business Details
                      </h2>
                      <dl class="detail-grid business-detail-grid">
                        <div>
                          <dt>Description</dt>
                          <dd>{{ details.description || 'Not provided' }}</dd>
                        </div>
                        <div>
                          <dt>Services</dt>
                          <dd>
                            {{
                              details.services.length ? details.services.join(', ') : 'Not provided'
                            }}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </section>
                } @else {
                  <section
                    class="tab-panel subscription-panel"
                    role="tabpanel"
                    aria-label="Subscription and payment"
                  >
                    <div class="detail-section">
                      <h2 class="detail-section-heading">
                        <span aria-hidden="true">♙</span> Subscription Details
                      </h2>
                      <dl class="detail-grid">
                        <div>
                          <dt>Subscription Plan</dt>
                          <dd>{{ details.subscriptionPlan }}</dd>
                        </div>
                        <div>
                          <dt>Monthly Amount</dt>
                          <dd>
                            {{
                              formatAmount(
                                details.subscriptionAmountCents,
                                details.subscriptionCurrency
                              )
                            }}
                          </dd>
                        </div>
                        <div>
                          <dt>Payment Status</dt>
                          <dd>{{ details.paymentStatus | titlecase }}</dd>
                        </div>
                        <div>
                          <dt>Registration Status</dt>
                          <dd>{{ details.registrationStatus | titlecase }}</dd>
                        </div>
                        <div>
                          <dt>Admin Approval</dt>
                          <dd>{{ details.adminApprovalStatus | titlecase }}</dd>
                        </div>
                        <div>
                          <dt>Account Status</dt>
                          <dd>{{ details.accountLifecycleStatus | titlecase }}</dd>
                        </div>
                        <div>
                          <dt>Registration Date</dt>
                          <dd>
                            {{
                              details.submittedAt
                                ? (details.submittedAt | date: 'medium')
                                : 'Not submitted'
                            }}
                          </dd>
                        </div>
                      </dl>
                      @if (
                        details.accountLifecycleStatus === 'active' &&
                        details.paymentStatus !== 'paid' &&
                        details.adminApprovalStatus !== 'approved'
                      ) {
                        <a class="primary-action" routerLink="/shop/payment">Continue to payment</a>
                      }
                    </div>
                    <section class="detail-section invoice-history" aria-labelledby="invoice-history-title">
                      <h2 id="invoice-history-title" class="detail-section-heading">
                        <span aria-hidden="true">▤</span> Invoice History
                      </h2>
                      <p class="invoice-intro">
                        View or download official billing documents issued by Stripe.
                      </p>
                      @if (invoiceError()) {
                        <div class="invoice-state error" role="alert">
                          <span>{{ invoiceError() }}</span>
                          <button type="button" (click)="loadInvoices(invoicePage())">
                            Try again
                          </button>
                        </div>
                      } @else if (invoiceLoading()) {
                        <p class="invoice-state" role="status">Loading invoices…</p>
                      } @else if (!invoices().length) {
                        <p class="invoice-state">
                          No invoices are available yet. Billing documents will appear here after
                          Stripe issues them.
                        </p>
                      } @else {
                        <div class="invoice-table-wrap">
                          <table class="invoice-table">
                            <thead>
                              <tr>
                                <th scope="col">Invoice</th>
                                <th scope="col">Date</th>
                                <th scope="col">Amount</th>
                                <th scope="col">Status</th>
                                <th scope="col">Document</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (invoice of invoices(); track invoice.stripeInvoiceId) {
                                <tr>
                                  <td>{{ invoice.invoiceNumber || invoice.stripeInvoiceId }}</td>
                                  <td>{{ invoice.generatedAt | date: 'mediumDate' }}</td>
                                  <td>
                                    {{ formatAmount(invoice.totalAmountCents, invoice.currency) }}
                                    @if (invoice.amountPaidCents < invoice.totalAmountCents) {
                                      <small>
                                        Paid:
                                        {{ formatAmount(invoice.amountPaidCents, invoice.currency) }}
                                      </small>
                                    }
                                    @if (invoice.refundedAmountCents > 0) {
                                      <small class="invoice-refund">
                                        Refunded:
                                        {{
                                          formatAmount(invoice.refundedAmountCents, invoice.currency)
                                        }}
                                      </small>
                                    }
                                  </td>
                                  <td>{{ invoice.status | titlecase }}</td>
                                  <td>
                                    <div class="invoice-links">
                                      @if (invoice.hostedInvoiceUrl) {
                                        <a
                                          [href]="invoice.hostedInvoiceUrl"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >View</a>
                                      }
                                      @if (invoice.invoicePdfUrl) {
                                        <a
                                          [href]="invoice.invoicePdfUrl"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >PDF</a>
                                      }
                                      @if (!invoice.hostedInvoiceUrl && !invoice.invoicePdfUrl) {
                                        <span>Document unavailable</span>
                                      }
                                    </div>
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                        @if (invoicePagination(); as pagination) {
                          <app-pagination
                            [total]="pagination.total"
                            [page]="pagination.page"
                            [pageSize]="pagination.limit"
                            [disabled]="invoiceLoading()"
                            ariaLabel="Invoice history pages"
                            (pageChange)="loadInvoices($event)"
                            (pageSizeChange)="changeInvoicePageSize($event)"
                          />
                        }
                      }
                    </section>
                  </section>
                }
              }
            </main>
          </div>

          @if (editingProfile()) {
            <section class="editing-panel" aria-label="Edit account profile">
              <app-profile-editor [showNameForm]="false" />
            </section>
          }
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
  private readonly shopRequests = inject(ShopRepairRequestsService);
  readonly profile = signal<ShopProfile | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly reviewSummary = signal<ShopReviewSummary | null>(null);
  readonly reviewError = signal('');
  readonly activeTab = signal<'company' | 'subscription'>('company');
  readonly editingProfile = signal(false);
  readonly invoices = signal<ShopInvoice[]>([]);
  readonly invoicePagination = signal<ShopInvoicePage['pagination'] | null>(null);
  readonly invoicePage = signal(1);
  readonly invoicePageSize = signal(10);
  readonly invoiceLoading = signal(true);
  readonly invoiceError = signal('');

  displayOwnerName(profile: ShopProfile): string {
    return [profile.ownerFirstName, profile.ownerLastName].filter(Boolean).join(' ');
  }

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
    this.shopRequests.getReviews().subscribe({
      next: (summary) => this.reviewSummary.set(summary),
      error: (error: unknown) =>
        this.reviewError.set(getAuthErrorMessage(error, 'Customer rating could not be loaded.')),
    });
    this.loadInvoices();
  }

  loadInvoices(page = 1): void {
    this.invoicePage.set(page);
    this.invoiceLoading.set(true);
    this.invoiceError.set('');
    this.invoices.set([]);
    this.invoicePagination.set(null);
    this.authService
      .getMyShopInvoices(page, this.invoicePageSize())
      .pipe(finalize(() => this.invoiceLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.invoices);
          this.invoicePagination.set(result.pagination);
        },
        error: (error: unknown) =>
          this.invoiceError.set(
            getAuthErrorMessage(error, 'Invoice history could not be loaded. Please try again.'),
          ),
      });
  }

  changeInvoicePageSize(size: number): void {
    if (![5, 10, 25, 100].includes(size) || size === this.invoicePageSize()) return;
    this.invoicePageSize.set(size);
    this.loadInvoices(1);
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
    this.editingProfile.set(false);
  }

  initials(name: string): string {
    return name.trim().slice(0, 1).toUpperCase() || 'S';
  }

  ratingStars(rating: number): string {
    const roundedRating = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating);
  }

  accountStatus(profile: ShopProfile): string {
    if (profile.accountLifecycleStatus !== 'active') {
      return profile.accountLifecycleStatus
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
    return profile.adminApprovalStatus === 'not_submitted'
      ? 'Not submitted'
      : profile.adminApprovalStatus
          .replaceAll('_', ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
