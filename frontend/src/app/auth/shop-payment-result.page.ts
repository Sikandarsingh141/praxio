import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shop-payment-result-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="registration-page shop-registration" aria-labelledby="payment-title">
      <header class="page-intro">
        <span class="page-eyebrow">SHOP PARTNER ACCOUNT</span>
        <h1 id="payment-title">
          {{ isSuccess ? 'Confirming your payment' : 'Payment not completed' }}
        </h1>
      </header>

      @if (isSuccess) {
        <div class="registration-card">
          <p role="status" aria-live="polite">{{ statusMessage() }}</p>
          <a class="secondary-action" routerLink="/auth/login"
            >Sign in to view your Shop registration</a
          >
        </div>
      } @else {
        <div class="registration-card">
          <p>Your shop account is saved, but payment is still required before Admin review.</p>
          @if (errorMessage()) {
            <p class="form-error" role="alert">{{ errorMessage() }}</p>
          }
          <label>
            Registration email
            <input #email type="email" autocomplete="email" required />
          </label>
          <label>
            Password
            <input #password type="password" autocomplete="current-password" required />
          </label>
          <div class="form-actions">
            <a class="secondary-action" routerLink="/auth/register">Back</a>
            <button
              type="button"
              class="primary-action"
              [disabled]="retrying() || !email.value || !password.value"
              (click)="retryCheckout(email.value, password.value)"
            >
              {{ retrying() ? 'Opening checkout…' : 'Continue to payment' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styleUrl: './shop-register.page.scss',
})
export class ShopPaymentResultPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly isSuccess = this.route.snapshot.data['paymentResult'] === 'success';
  readonly retrying = signal(false);
  readonly statusMessage = signal('Verifying payment with Stripe…');
  readonly errorMessage = signal('');

  constructor() {
    if (!this.isSuccess) {
      return;
    }

    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      this.statusMessage.set('Payment confirmation could not be found. Contact support.');
      return;
    }

    this.authService.confirmShopPayment(sessionId).subscribe({
      next: () =>
        this.authService.loadCurrentUser().subscribe({
          next: (user) => {
            if (user?.accountType === 'shop') {
              void this.router.navigateByUrl('/shop/profile');
              return;
            }
            this.statusMessage.set(
              'Payment confirmed. Sign in to view your Shop profile and registration status.',
            );
          },
          error: (error: unknown) =>
            this.statusMessage.set(
              getAuthErrorMessage(
                error,
                'Payment confirmed. Sign in to view your Shop profile and registration status.',
              ),
            ),
        }),
      error: (error: unknown) =>
        this.statusMessage.set(
          getAuthErrorMessage(
            error,
            'Payment confirmation is pending. Please refresh shortly or contact support.',
          ),
        ),
    });
  }

  retryCheckout(email: string, password: string): void {
    if (this.retrying() || !email.trim() || !password) {
      return;
    }

    this.errorMessage.set('');
    this.retrying.set(true);
    this.authService
      .retryShopCheckout(email.trim(), password)
      .pipe(finalize(() => this.retrying.set(false)))
      .subscribe({
        next: (checkoutUrl) => this.redirectToCheckout(checkoutUrl),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to reopen checkout. Please try again.'),
          ),
      });
  }

  redirectToCheckout(checkoutUrl: string): void {
    window.location.assign(checkoutUrl);
  }
}
