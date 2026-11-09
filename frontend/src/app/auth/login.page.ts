import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly errorMessage = signal('');
  readonly noticeMessage = signal(this.getSessionNotice());
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.authService
      .login(email, password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () =>
          void this.router.navigateByUrl(this.authService.loginDestination() ?? '/customer'),
        error: (error: unknown) =>
          this.errorMessage.set(getAuthErrorMessage(error, 'Unable to sign in. Please try again.')),
      });
  }

  private getSessionNotice(): string {
    switch (this.route.snapshot.queryParamMap.get('reason')) {
      case 'session-unavailable':
        return 'We could not verify your session. Please sign in again.';
      case 'logout-unconfirmed':
        return 'We could not confirm sign-out with the server.';
      default:
        return '';
    }
  }
}
