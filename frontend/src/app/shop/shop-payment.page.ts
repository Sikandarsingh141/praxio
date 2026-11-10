import { Component, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';
import { ShopPaymentStatus } from '../core/auth/auth.models';

@Component({
  selector: 'app-shop-payment-page',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  template: `
    <section class="registration-page shop-registration" aria-labelledby="shop-payment-title">
      <header class="page-intro">
        <span class="page-eyebrow">SHOP PARTNER ACCOUNT</span>
        <h1 id="shop-payment-title">Complete your subscription payment</h1>
        <p>Secure card details are collected directly by Stripe Checkout.</p>
      </header>

      <div class="registration-card">
        @if (route.snapshot.queryParamMap.has('cancelled')) {
          <p class="approval-note" role="status">Payment was not completed. You can try again.</p>
        }
        @if (errorMessage()) {
          <p class="form-error" role="alert">{{ errorMessage() }}</p>
        }
        @if (payment(); as details) {
          <section class="review-section">
            <h2>{{ details.subscriptionPlan }}</h2>
            <p>
              <strong>{{ formatAmount(details.amountCents, details.currency) }}</strong>
              billed monthly
            </p>
            <dl>
              <div>
                <dt>Plan</dt>
                <dd>{{ details.subscriptionPlan }}</dd>
              </div>
              <div>
                <dt>Billing frequency</dt>
                <dd>Monthly</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>{{ details.paymentStatus | titlecase }}</dd>
              </div>
              <div>
                <dt>Registration status</dt>
                <dd>{{ details.registrationStatus | titlecase }}</dd>
              </div>
            </dl>
          </section>
          <p class="step-description">
            Your card information is entered on Stripe's secure page and is never stored by Fixroa.
          </p>
          <div class="form-actions">
            <button
              type="button"
              class="primary-action"
              [disabled]="openingCheckout()"
              (click)="continueToStripe()"
            >
              {{
                openingCheckout() ? 'Opening secure payment…' : 'Continue to secure card payment'
              }}
            </button>
          </div>
        } @else if (loading()) {
          <p role="status">Loading your payment details…</p>
        }
        <a class="secondary-action" routerLink="/shop/profile">View registration status</a>
      </div>
    </section>
  `,
  styleUrl: '../auth/shop-register.page.scss',
})
export class ShopPaymentPage implements OnInit {
  readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  readonly payment = signal<ShopPaymentStatus | null>(null);
  readonly loading = signal(true);
  readonly openingCheckout = signal(false);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.authService
      .getShopPaymentStatus()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (status) => this.payment.set(status),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to load payment details. Please try again.'),
          ),
      });
  }

  formatAmount(amountCents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  }

  continueToStripe(): void {
    if (this.openingCheckout()) {
      return;
    }

    this.errorMessage.set('');
    this.openingCheckout.set(true);
    this.authService
      .createShopCheckout()
      .pipe(finalize(() => this.openingCheckout.set(false)))
      .subscribe({
        next: (checkoutUrl) => window.location.assign(checkoutUrl),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to open secure payment. Please try again.'),
          ),
      });
  }
}
