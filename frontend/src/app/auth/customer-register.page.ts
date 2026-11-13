import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';
import { FirebaseMessagingService } from '../core/notifications/firebase-messaging.service';
import { PHONE_COUNTRY_CODES } from './phone-country-codes';

const REGISTRATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_MAX_BYTES = 1024 * 1024;

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-customer-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './customer-register.page.html',
  styleUrl: './customer-register.page.scss',
})
export class CustomerRegisterPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly firebaseMessaging = inject(FirebaseMessagingService);
  readonly pushConfigured = this.firebaseMessaging.isConfigured();
  readonly phoneCountryCodes = PHONE_COUNTRY_CODES;
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly pushWarning = signal('');
  readonly locationMessage = signal('');
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly profileImageData = signal('');
  readonly profileImageName = signal('');
  readonly profileImageError = signal('');

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.passwordVisible.update((visible) => !visible);
      return;
    }

    this.confirmPasswordVisible.update((visible) => !visible);
  }

  readonly form = this.formBuilder.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      countryCode: ['+91', Validators.required],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      profileImageData: [''],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
        ],
      ],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
      enableNotifications: false,
      latitude: null as number | null,
      longitude: null as number | null,
    },
    { validators: passwordsMatch },
  );

  useCurrentLocation(): void {
    this.locationMessage.set('');
    if (!navigator.geolocation) {
      this.locationMessage.set('This browser does not support location access.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.form.patchValue({
          latitude: Number(coords.latitude.toFixed(6)),
          longitude: Number(coords.longitude.toFixed(6)),
        });
        this.locationMessage.set('Your location was added to your registration.');
      },
      (error: GeolocationPositionError) => {
        this.locationMessage.set(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access in your browser and try again.'
            : 'Could not determine your location. Please try again.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  mapUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  selectProfileImage(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const image = input.files?.[0];
    input.value = '';
    this.profileImageError.set('');
    if (!image) return;
    if (
      !REGISTRATION_IMAGE_TYPES.has(image.type) ||
      image.size === 0 ||
      image.size > PROFILE_IMAGE_MAX_BYTES
    ) {
      this.profileImageError.set('Choose a JPEG, PNG, or WebP image up to 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        this.profileImageError.set('The selected image could not be read. Try another image.');
        return;
      }
      this.profileImageData.set(reader.result);
      this.profileImageName.set(image.name);
      this.form.controls.profileImageData.setValue(reader.result);
    };
    reader.onerror = () => {
      this.profileImageError.set('The selected image could not be read. Try another image.');
    };
    reader.readAsDataURL(image);
  }

  removeProfileImage(): void {
    this.profileImageData.set('');
    this.profileImageName.set('');
    this.form.controls.profileImageData.setValue('');
    this.profileImageError.set('');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.pushWarning.set('');
    this.submitting.set(true);
    const {
      firstName,
      lastName,
      email,
      countryCode,
      mobileNumber,
      profileImageData,
      password,
      enableNotifications,
      latitude,
      longitude,
    } = this.form.getRawValue();
    const input: Parameters<AuthService['registerCustomer']>[0] = {
      firstName,
      lastName,
      email,
      countryCode,
      mobileNumber,
      password,
      acceptTerms: true,
      ...(profileImageData ? { profileImageData } : {}),
      ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
    };

    if (enableNotifications) {
      void this.firebaseMessaging
        .requestDeviceToken()
        .then((notificationToken) => this.registerCustomer({ ...input, notificationToken }))
        .catch((error: unknown) => {
          this.pushWarning.set(
            getAuthErrorMessage(
              error,
              'Browser alerts could not be enabled. Your registration will continue without push alerts.',
            ),
          );
          this.registerCustomer(input);
        });
      return;
    }

    this.registerCustomer(input);
  }

  private registerCustomer(input: Parameters<AuthService['registerCustomer']>[0]): void {
    this.authService
      .registerCustomer(input)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.form.reset();
          this.profileImageData.set('');
          this.profileImageName.set('');
          this.successMessage.set('Your customer account is ready. You can now sign in.');
        },
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to create your account. Please try again.'),
          ),
      });
  }
}
