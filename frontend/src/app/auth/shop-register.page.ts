import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';
import { RegistrationAddressSuggestion } from '../core/auth/auth.models';
import { FirebaseMessagingService } from '../core/notifications/firebase-messaging.service';
import {
  ShopRegistrationDraft,
  ShopRegistrationDraftService,
} from './shop-registration-draft.service';
import { PHONE_COUNTRY_CODES } from './phone-country-codes';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

function hasSelectedServices(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0
    ? null
    : { serviceRequired: true };
}

const REGISTRATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_MAX_BYTES = 1024 * 1024;
const SHOP_IMAGE_MAX_BYTES = 256 * 1024;

@Component({
  selector: 'app-shop-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './shop-register.page.html',
  styleUrl: './shop-register.page.scss',
})
export class ShopRegisterPage implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly draftService = inject(ShopRegistrationDraftService);
  private readonly authService = inject(AuthService);
  private readonly firebaseMessaging = inject(FirebaseMessagingService);
  readonly pushConfigured = this.firebaseMessaging.isConfigured();
  readonly currentStep = signal(0);
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly submitting = signal(false);
  readonly retryingPayment = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly pushWarning = signal('');
  readonly addressLookupMessage = signal('');
  readonly addressSuggestions = signal<RegistrationAddressSuggestion[]>([]);
  readonly addressSuggestionsLoading = signal(false);
  readonly addressSuggestionsVisible = signal(false);
  readonly activeAddressSuggestion = signal(-1);
  readonly profileImageData = signal('');
  readonly profileImageName = signal('');
  readonly profileImageError = signal('');
  readonly shopImageData = signal('');
  readonly shopImageName = signal('');
  readonly shopImageError = signal('');
  private readonly addressInput = new Subject<string>();
  private readonly destroyed = new Subject<void>();
  private selectedAddress = '';
  private addressBlurTimer?: ReturnType<typeof setTimeout>;
  readonly phoneCountryCodes = PHONE_COUNTRY_CODES;

  ngOnInit(): void {
    this.addressInput
      .pipe(
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 3) {
            this.addressSuggestions.set([]);
            this.addressSuggestionsLoading.set(false);
            return of([]);
          }
          this.addressSuggestionsLoading.set(true);
          this.addressLookupMessage.set('');
          return timer(350).pipe(
            switchMap(() => this.authService.suggestRegistrationAddresses(query)),
            catchError(() => {
              this.addressLookupMessage.set(
                'Location suggestions are temporarily unavailable. You can still enter the location manually.',
              );
              return of([]);
            }),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe((suggestions) => {
        this.addressSuggestions.set(suggestions);
        this.addressSuggestionsLoading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    if (this.addressBlurTimer) clearTimeout(this.addressBlurTimer);
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.passwordVisible.update((visible) => !visible);
      return;
    }

    this.confirmPasswordVisible.update((visible) => !visible);
  }

  readonly stepNames = ['Owner information', 'Business details', 'Shop location', 'Services'];

  readonly businessTypes = [
    'Electronics Repair Shop',
    'Electrician',
    'AC Repair Service',
    'Mobile Repair Shop',
    'Laptop & Computer Repair',
    'Home Appliance Repair',
    'Independent Technician',
  ];

  readonly services = [
    { name: 'Refrigerator Repair', icon: 'refrigerator' },
    { name: 'AC Repair', icon: 'air-conditioner' },
    { name: 'Washing Machine Repair', icon: 'washing-machine' },
    { name: 'TV Repair', icon: 'television' },
    { name: 'Mobile Repair', icon: 'mobile' },
    { name: 'Laptop Repair', icon: 'laptop' },
    { name: 'Fan Repair', icon: 'fan' },
    { name: 'Cooler Repair', icon: 'cooler' },
  ] as const;

  readonly form = this.formBuilder.nonNullable.group(
    {
      ownerFullName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      countryCode: ['+91', Validators.required],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
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
      profileImageData: [''],
      shopImageData: [''],
      shopName: ['', [Validators.required, Validators.maxLength(120)]],
      businessType: ['', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(1000)]],
      yearsOfExperience: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      street: ['', Validators.maxLength(200)],
      area: ['', Validators.maxLength(100)],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      state: ['', [Validators.required, Validators.maxLength(100)]],
      country: ['', Validators.maxLength(100)],
      postalCode: ['', [Validators.required, Validators.pattern(/^[\p{L}\d -]{3,12}$/u)]],
      landmark: ['', Validators.maxLength(150)],
      latitude: [null as number | null],
      longitude: [null as number | null],
      services: this.formBuilder.nonNullable.control<string[]>([], hasSelectedServices),
      enableNotifications: false,
    },
    { validators: passwordsMatch },
  );

  constructor() {
    const draft = this.draftService.getDraft();
    if (draft) {
      this.form.patchValue(draft);
      this.profileImageData.set(draft.profileImageData ?? '');
      this.profileImageName.set(draft.profileImageData ? 'Profile photo uploaded' : '');
      this.shopImageData.set(draft.shopImageData ?? '');
      this.shopImageName.set(draft.shopImageData ? 'Shop photo uploaded' : '');
    }

    const editStep = this.router.getCurrentNavigation()?.extras.state?.['editStep'];
    if (typeof editStep === 'number' && editStep >= 0 && editStep < this.stepNames.length) {
      this.currentStep.set(editStep);
    }
  }

  private readonly controlsByStep = [
    ['ownerFullName', 'email', 'mobileNumber', 'password', 'confirmPassword'],
    ['shopName', 'businessType', 'description', 'yearsOfExperience'],
    ['address', 'city', 'state', 'postalCode', 'landmark'],
    ['services'],
  ];

  readonly locationMessage = signal('');

  onAddressInput(input: HTMLInputElement): void {
    if (this.selectedAddress && input.value === this.selectedAddress) {
      return;
    }
    if (this.selectedAddress) {
      this.clearResolvedAddress();
    }
    this.selectedAddress = '';
    this.activeAddressSuggestion.set(-1);

    const query = input.value.trim();
    this.addressSuggestionsVisible.set(query.length >= 3);
    this.addressLookupMessage.set('');
    if (query.length < 3) {
      this.addressSuggestions.set([]);
      this.addressSuggestionsLoading.set(false);
    }
    this.addressInput.next(query);
  }

  onAddressKeydown(event: KeyboardEvent): void {
    const suggestions = this.addressSuggestions();
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      this.addressSuggestionsVisible.set(true);
      this.activeAddressSuggestion.update((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      this.addressSuggestionsVisible.set(true);
      this.activeAddressSuggestion.update((index) => (index <= 0 ? suggestions.length : index) - 1);
    } else if (event.key === 'Enter' && this.activeAddressSuggestion() >= 0) {
      event.preventDefault();
      this.selectAddress(suggestions[this.activeAddressSuggestion()]);
    } else if (event.key === 'Escape') {
      this.addressSuggestionsVisible.set(false);
      this.activeAddressSuggestion.set(-1);
    }
  }

  onAddressBlur(): void {
    if (this.addressBlurTimer) {
      clearTimeout(this.addressBlurTimer);
    }
    this.addressBlurTimer = setTimeout(() => {
      this.addressSuggestionsVisible.set(false);
    }, 120);
  }

  selectAddress(suggestion: RegistrationAddressSuggestion): void {
    this.addressSuggestionsVisible.set(false);
    this.addressSuggestionsLoading.set(false);
    this.activeAddressSuggestion.set(-1);
    this.selectedAddress = suggestion.label;
    this.form.patchValue({
      address: suggestion.label,
      ...(suggestion.street ? { street: suggestion.street } : {}),
      ...(suggestion.area ? { area: suggestion.area } : {}),
      ...(suggestion.city ? { city: suggestion.city } : {}),
      ...(suggestion.state ? { state: suggestion.state } : {}),
      ...(suggestion.country ? { country: suggestion.country } : {}),
      ...(suggestion.postalCode ? { postalCode: suggestion.postalCode } : {}),
      latitude: Number(suggestion.latitude.toFixed(6)),
      longitude: Number(suggestion.longitude.toFixed(6)),
    });
    this.addressLookupMessage.set(
      this.form.controls.street.value &&
        this.form.controls.city.value &&
        this.form.controls.state.value &&
        this.form.controls.country.value &&
        this.form.controls.postalCode.value
        ? 'Address, location, and map coordinates were filled.'
        : 'Address selected. Some address details are unavailable; complete any missing fields manually.',
    );
  }

  private clearResolvedAddress(clearAddress = false): void {
    this.form.patchValue({
      street: '',
      area: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      latitude: null,
      longitude: null,
    });
    if (clearAddress) {
      this.form.controls.address.setValue('');
    }
  }

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
        this.locationMessage.set('Your shop location was added.');
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
    this.readRegistrationImage(
      event,
      PROFILE_IMAGE_MAX_BYTES,
      '1 MB',
      (imageData, fileName) => {
        this.profileImageData.set(imageData);
        this.profileImageName.set(fileName);
        this.form.controls.profileImageData.setValue(imageData);
      },
      (message) => this.profileImageError.set(message),
    );
  }

  selectShopImage(event: Event): void {
    this.readRegistrationImage(
      event,
      SHOP_IMAGE_MAX_BYTES,
      '256 KB',
      (imageData, fileName) => {
        this.shopImageData.set(imageData);
        this.shopImageName.set(fileName);
        this.form.controls.shopImageData.setValue(imageData);
      },
      (message) => this.shopImageError.set(message),
    );
  }

  private readRegistrationImage(
    event: Event,
    maxBytes: number,
    maxSizeLabel: string,
    onImageRead: (imageData: string, fileName: string) => void,
    setError: (message: string) => void,
  ): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const image = input.files?.[0];
    input.value = '';
    setError('');
    if (!image) return;
    if (!REGISTRATION_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > maxBytes) {
      setError(`Choose a JPEG, PNG, or WebP image up to ${maxSizeLabel}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('The selected image could not be read. Try another image.');
        return;
      }
      onImageRead(reader.result, image.name);
    };
    reader.onerror = () => {
      setError('The selected image could not be read. Try another image.');
    };
    reader.readAsDataURL(image);
  }

  removeProfileImage(): void {
    this.profileImageData.set('');
    this.profileImageName.set('');
    this.form.controls.profileImageData.setValue('');
    this.profileImageError.set('');
  }

  removeShopImage(): void {
    this.shopImageData.set('');
    this.shopImageName.set('');
    this.form.controls.shopImageData.setValue('');
    this.shopImageError.set('');
  }

  isServiceSelected(service: string): boolean {
    return this.form.controls.services.value.includes(service);
  }

  toggleService(service: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form.controls.services.value;
    const next = checked
      ? [...current, service]
      : current.filter((selected) => selected !== service);
    this.form.controls.services.setValue(next);
    this.form.controls.services.markAsTouched();
  }

  next(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.currentStep() === this.stepNames.length - 1) {
      return;
    }

    this.currentStep.update((step) => step + 1);
  }

  previous(): void {
    this.currentStep.update((step) => Math.max(step - 1, 0));
  }

  goToStep(step: number): void {
    if (step < this.currentStep()) {
      this.currentStep.set(step);
    }
  }

  submit(): void {
    if (this.currentStep() !== this.stepNames.length - 1) {
      this.next();
      return;
    }

    if (this.submitting() || !this.validateCurrentStep() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { enableNotifications, ...draft } = this.form.getRawValue();
    this.draftService.setDraft(draft);
    this.errorMessage.set('');
    this.pushWarning.set('');
    this.submitting.set(true);
    if (enableNotifications) {
      void this.firebaseMessaging
        .requestDeviceToken()
        .then((notificationToken) => this.submitRegistration(draft, notificationToken))
        .catch((error: unknown) => {
          this.pushWarning.set(
            getAuthErrorMessage(
              error,
              'Browser alerts could not be enabled. Your registration will continue without push alerts.',
            ),
          );
          this.submitRegistration(draft);
        });
      return;
    }
    this.submitRegistration(draft);
  }

  private submitRegistration(draft: ShopRegistrationDraft, notificationToken?: string): void {
    this.authService
      .registerShop({
        fullName: draft.ownerFullName,
        email: draft.email,
        countryCode: draft.countryCode,
        mobileNumber: draft.mobileNumber,
        password: draft.password,
        ...(draft.profileImageData ? { profileImageData: draft.profileImageData } : {}),
        ...(draft.shopImageData ? { shopImageData: draft.shopImageData } : {}),
        shopName: draft.shopName,
        businessType: draft.businessType,
        description: draft.description,
        yearsOfExperience: draft.yearsOfExperience,
        address: draft.address,
        street: draft.street,
        area: draft.area,
        city: draft.city,
        state: draft.state,
        country: draft.country,
        postalCode: draft.postalCode,
        landmark: draft.landmark,
        ...(draft.latitude !== null && draft.longitude !== null
          ? { latitude: draft.latitude, longitude: draft.longitude }
          : {}),
        services: draft.services,
        ...(notificationToken ? { notificationToken } : {}),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (result) => {
          this.draftService.clearDraft();
          this.successMessage.set(
            'Shop registration submitted. Redirecting to secure Stripe Checkout…',
          );
          this.redirectToCheckout(result.checkoutUrl);
        },
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(
              error,
              'Unable to submit your shop registration. Please try again.',
            ),
          ),
      });
  }

  retryPayment(): void {
    if (this.retryingPayment()) {
      return;
    }

    const { email, password } = this.form.getRawValue();
    if (!email || !password) {
      this.errorMessage.set('Enter your registration email and password to resume payment.');
      return;
    }

    this.errorMessage.set('');
    this.retryingPayment.set(true);
    this.authService
      .retryShopCheckout(email, password)
      .pipe(finalize(() => this.retryingPayment.set(false)))
      .subscribe({
        next: (checkoutUrl) => {
          this.draftService.clearDraft();
          this.redirectToCheckout(checkoutUrl);
        },
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to reopen checkout. Please try again.'),
          ),
      });
  }

  redirectToCheckout(checkoutUrl: string): void {
    window.location.assign(checkoutUrl);
  }

  private validateCurrentStep(): boolean {
    const step = this.currentStep();
    const controlNames = this.controlsByStep[step];
    for (const controlName of controlNames) {
      this.form.get(controlName)?.markAsTouched();
    }

    const stepInvalid = controlNames.some(
      (controlName) => this.form.get(controlName)?.invalid ?? true,
    );
    return !stepInvalid && !(step === 0 && this.form.hasError('passwordMismatch'));
  }
}
