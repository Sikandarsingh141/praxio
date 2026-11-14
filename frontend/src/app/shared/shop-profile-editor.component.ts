import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  RegistrationAddressSuggestion,
  ShopBusinessDetailsUpdate,
  ShopProfile,
} from '../core/auth/auth.models';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-shop-profile-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="shop-profile-editor" aria-labelledby="business-details-title">
      @if (errorMessage()) {
        <p class="feedback error" role="alert">{{ errorMessage() }}</p>
      }
      @if (successMessage()) {
        <p class="feedback success" role="status">{{ successMessage() }}</p>
      }

      @if (editing()) {
        <form [formGroup]="form" (ngSubmit)="saveProfile()">
          <div class="form-grid">
            <h2 id="business-details-title" class="form-section-heading wide">
              <span aria-hidden="true">▤</span> Company Information
            </h2>
            <label>
              Company Name <span class="required" aria-hidden="true">*</span>
              <input formControlName="shopName" maxlength="120" />
              @if (form.controls.shopName.touched && form.controls.shopName.invalid) {
                <small class="field-error">Enter a shop name (up to 120 characters).</small>
              }
            </label>
            <label>
              Owner First Name <span class="required" aria-hidden="true">*</span>
              <input formControlName="ownerFirstName" maxlength="50" autocomplete="given-name" />
              @if (form.controls.ownerFirstName.touched && form.controls.ownerFirstName.invalid) {
                <small class="field-error">Enter the owner's first name.</small>
              }
            </label>
            <label>
              Owner Last Name <span class="required" aria-hidden="true">*</span>
              <input formControlName="ownerLastName" maxlength="50" autocomplete="family-name" />
              @if (form.controls.ownerLastName.touched && form.controls.ownerLastName.invalid) {
                <small class="field-error">Enter the owner's last name.</small>
              }
            </label>
            <label>
              Email Address
              <input [value]="profile.email" readonly aria-label="Email address (read only)" />
            </label>
            <label>
              Country Code <span class="required" aria-hidden="true">*</span>
              <input formControlName="countryCode" maxlength="5" placeholder="+1" />
              @if (form.controls.countryCode.touched && form.controls.countryCode.invalid) {
                <small class="field-error">Enter a country calling code, such as +1.</small>
              }
            </label>
            <label>
              Phone Number <span class="required" aria-hidden="true">*</span>
              <input
                type="tel"
                formControlName="mobileNumber"
                maxlength="10"
                autocomplete="tel-national"
              />
              @if (form.controls.mobileNumber.touched && form.controls.mobileNumber.invalid) {
                <small class="field-error">Enter exactly 10 phone digits.</small>
              }
            </label>
            <label>
              Business Type <span class="required" aria-hidden="true">*</span>
              <input formControlName="businessType" maxlength="120" />
              @if (form.controls.businessType.touched && form.controls.businessType.invalid) {
                <small class="field-error">Enter a business type.</small>
              }
            </label>
            <label>
              Years of Experience <span class="required" aria-hidden="true">*</span>
              <input type="number" formControlName="yearsOfExperience" min="0" max="100" step="1" />
              @if (
                form.controls.yearsOfExperience.touched && form.controls.yearsOfExperience.invalid
              ) {
                <small class="field-error">Enter a number from 0 to 100.</small>
              }
            </label>
            <h2 class="form-section-heading wide">
              <span aria-hidden="true">⌖</span> Business Address Information
            </h2>
            <label class="wide address-search inline-search-field">
              Search address
              <input
                type="search"
                [value]="addressQuery()"
                (input)="searchAddress($event)"
                placeholder="Search for a location"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="shop-profile-address-suggestions"
                [attr.aria-expanded]="addressSuggestionsVisible()"
              />
              @if (searchingAddress()) {
                <span
                  class="inline-search-spinner"
                  role="status"
                  aria-label="Searching addresses"
                ></span>
              }
              @if (addressSuggestionsVisible()) {
                <div
                  id="shop-profile-address-suggestions"
                  class="address-suggestions"
                  role="listbox"
                  aria-label="Address suggestions"
                >
                  @if (searchingAddress()) {
                    <p class="suggestion-state" role="status">Searching addresses…</p>
                  } @else if (addressSearchError()) {
                    <p class="suggestion-state error" role="alert">{{ addressSearchError() }}</p>
                  } @else if (addressSuggestions().length) {
                    @for (suggestion of addressSuggestions(); track suggestion.label) {
                      <button
                        type="button"
                        role="option"
                        class="address-suggestion"
                        (mousedown)="$event.preventDefault()"
                        (click)="selectAddress(suggestion)"
                      >
                        {{ suggestion.label }}
                      </button>
                    }
                  } @else {
                    <p class="suggestion-state">No matching addresses found.</p>
                  }
                </div>
              }
            </label>
            <label class="wide">
              Address
              <textarea
                formControlName="address"
                rows="2"
                maxlength="200"
                (input)="clearSelectedLocation()"
              ></textarea>
              @if (form.controls.address.touched && form.controls.address.invalid) {
                <small class="field-error">Enter an address.</small>
              }
            </label>
            <label>
              Country
              <input formControlName="country" maxlength="100" />
            </label>
            <label>
              Street
              <input formControlName="street" maxlength="200" />
            </label>
            <label>
              Area
              <input formControlName="area" maxlength="100" />
            </label>
            <label>
              State <span class="required" aria-hidden="true">*</span>
              <input formControlName="state" maxlength="100" />
              @if (form.controls.state.touched && form.controls.state.invalid) {
                <small class="field-error">Enter a state or province.</small>
              }
            </label>
            <label>
              City <span class="required" aria-hidden="true">*</span>
              <input formControlName="city" maxlength="100" />
              @if (form.controls.city.touched && form.controls.city.invalid) {
                <small class="field-error">Enter a city.</small>
              }
            </label>
            <label>
              Zip Code <span class="required" aria-hidden="true">*</span>
              <input formControlName="postalCode" maxlength="12" />
              @if (form.controls.postalCode.touched && form.controls.postalCode.invalid) {
                <small class="field-error">Enter a valid zip or postal code.</small>
              }
            </label>
            <label>
              Landmark
              <input formControlName="landmark" maxlength="150" />
            </label>
            <label class="wide">
              Business Description <span class="required" aria-hidden="true">*</span>
              <textarea formControlName="description" rows="3" maxlength="1000"></textarea>
              @if (form.controls.description.touched && form.controls.description.invalid) {
                <small class="field-error">Enter a description (up to 1,000 characters).</small>
              }
            </label>
            <label class="wide">
              Services <span class="required" aria-hidden="true">*</span>
              <textarea
                formControlName="servicesText"
                rows="3"
                maxlength="2000"
                placeholder="Separate services with commas or new lines"
              ></textarea>
              @if (form.controls.servicesText.touched && form.controls.servicesText.invalid) {
                <small class="field-error">Enter at least one service.</small>
              }
            </label>
          </div>

          <div class="form-actions">
            <button
              class="cancel-button"
              type="button"
              [disabled]="saving()"
              (click)="cancelEdit()"
            >
              Cancel
            </button>
            <button class="save-button" type="submit" [disabled]="saving()">
              {{ saving() ? 'Saving changes…' : 'Save Changes' }}
            </button>
          </div>
        </form>
      } @else {
        <dl>
          <div>
            <dt>First Name</dt>
            <dd>{{ profile.ownerFirstName }}</dd>
          </div>
          <div>
            <dt>Last Name</dt>
            <dd>{{ profile.ownerLastName }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ profile.email }}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{{ profile.countryCode }} {{ profile.mobileNumber || 'Not provided' }}</dd>
          </div>
          <div>
            <dt>Business type</dt>
            <dd>{{ profile.businessType }}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{{ profile.yearsOfExperience }} years</dd>
          </div>
          <div>
            <dt>Business address</dt>
            <dd>{{ profile.businessAddress }}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{{ profile.description }}</dd>
          </div>
          <div>
            <dt>Services</dt>
            <dd>{{ profile.services.length ? profile.services.join(', ') : 'Not provided' }}</dd>
          </div>
        </dl>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin: 0 0 1rem;
    }

    .shop-profile-editor {
      display: grid;
      gap: 1rem;
    }

    .form-section-heading {
      display: flex;
      min-height: 2rem;
      align-items: center;
      gap: 0.55rem;
      margin: 0;
      padding: 0.35rem 0.65rem;
      border-radius: 0.5rem;
      background: #edf6ee;
      color: #17231b;
      font-size: 0.85rem;
      font-weight: 750;
    }

    .form-section-heading span {
      color: #16803c;
    }

    .save-button,
    .cancel-button {
      min-height: 2.4rem;
      padding: 0.45rem 0.85rem;
      border: 1px solid #087c3b;
      border-radius: 0.55rem;
      background: #087c3b;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .cancel-button {
      border-color: #d7e0d9;
      background: #fff;
      color: #43544a;
    }

    button:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem 1rem;
      margin: 0;
    }

    dl > div {
      min-width: 0;
    }

    dt {
      margin-bottom: 0.35rem;
      color: #84918a;
      font-size: 0.72rem;
    }

    dd {
      margin: 0;
      color: #304139;
      font-size: 0.84rem;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    form {
      display: grid;
      gap: 1.2rem;
    }

    .form-grid {
      align-items: start;
    }

    .form-grid > label {
      display: grid;
      min-width: 0;
      gap: 0.35rem;
      color: #27342c;
      font-size: 0.73rem;
      font-weight: 700;
    }

    input,
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.4rem;
      padding: 0.55rem 0.7rem;
      border: 1px solid #d8dfdc;
      border-radius: 0.45rem;
      background: #fff;
      color: #26352c;
      font: inherit;
      font-size: 0.78rem;
    }

    input[readonly] {
      background: #f7f8f7;
      color: #59665e;
    }

    textarea {
      resize: vertical;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .required {
      color: #dc2626;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
    }

    .field-error,
    .feedback {
      color: #a63d34;
      font-size: 0.72rem;
    }

    .feedback {
      margin: 0;
    }

    .feedback.success {
      color: #39704a;
    }

    .address-search {
      position: relative;
    }

    .address-suggestions {
      position: absolute;
      z-index: 5;
      top: calc(100% + 0.25rem);
      right: 0;
      left: 0;
      max-height: 16rem;
      overflow: auto;
      border: 1px solid #dce5de;
      border-radius: 0.55rem;
      background: #fff;
      box-shadow: 0 0.6rem 1.5rem rgb(35 49 59 / 14%);
    }

    .address-suggestion,
    .suggestion-state {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0.7rem 0.8rem;
      border: 0;
      border-bottom: 1px solid #edf1ed;
      background: #fff;
      color: #43544a;
      text-align: left;
      font: inherit;
      font-size: 0.76rem;
    }

    .address-suggestion {
      cursor: pointer;
    }

    .address-suggestion:hover,
    .address-suggestion:focus-visible {
      background: #f0f7f1;
    }

    .suggestion-state.error {
      color: #a63d34;
    }

    @media (max-width: 620px) {
      .form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .wide {
        grid-column: auto;
      }
    }

    @media (max-width: 420px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .wide {
        grid-column: auto;
      }
    }
  `,
})
export class ShopProfileEditorComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addressQueryInput = new Subject<string>();
  @Input({ required: true }) profile!: ShopProfile;
  @Output() readonly profileUpdated = new EventEmitter<ShopProfile>();
  @Output() readonly editCancelled = new EventEmitter<void>();

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly addressQuery = signal('');
  readonly addressSuggestions = signal<RegistrationAddressSuggestion[]>([]);
  readonly addressSuggestionsVisible = signal(false);
  readonly searchingAddress = signal(false);
  readonly addressSearchError = signal('');
  readonly form = this.formBuilder.group({
    ownerFirstName: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50),
    ]),
    ownerLastName: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50),
    ]),
    countryCode: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^\+\d{1,4}$/),
    ]),
    mobileNumber: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^\d{10}$/),
    ]),
    shopName: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    businessType: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    description: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(1000),
    ]),
    yearsOfExperience: this.formBuilder.nonNullable.control(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    address: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    street: this.formBuilder.nonNullable.control('', Validators.maxLength(200)),
    area: this.formBuilder.nonNullable.control('', Validators.maxLength(100)),
    city: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    state: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    country: this.formBuilder.nonNullable.control('', Validators.maxLength(100)),
    postalCode: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[\p{L}\d -]{3,12}$/u),
    ]),
    landmark: this.formBuilder.nonNullable.control('', Validators.maxLength(150)),
    servicesText: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(2000),
    ]),
    location: this.formBuilder.control<{ latitude: number; longitude: number } | null>(null),
  });

  constructor() {
    this.addressQueryInput
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 3) {
            this.searchingAddress.set(false);
            return of([]);
          }
          this.searchingAddress.set(true);
          this.addressSearchError.set('');
          return this.authService.suggestRegistrationAddresses(query).pipe(
            catchError(() => {
              this.addressSearchError.set(
                'Address suggestions are unavailable. You can enter the address manually.',
              );
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((suggestions) => {
        this.addressSuggestions.set(suggestions);
        this.searchingAddress.set(false);
      });
  }

  ngOnInit(): void {
    this.startEditing();
  }

  startEditing(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.addressQuery.set('');
    this.addressSuggestions.set([]);
    this.addressSuggestionsVisible.set(false);
    this.form.patchValue({
      ownerFirstName: this.profile.ownerFirstName,
      ownerLastName: this.profile.ownerLastName,
      countryCode: this.profile.countryCode,
      mobileNumber: this.profile.mobileNumber,
      shopName: this.profile.shopName,
      businessType: this.profile.businessType,
      description: this.profile.description,
      yearsOfExperience: this.profile.yearsOfExperience,
      address: this.profile.address,
      street: this.profile.street ?? '',
      area: this.profile.area ?? '',
      city: this.profile.city,
      state: this.profile.state,
      country: this.profile.country ?? '',
      postalCode: this.profile.postalCode,
      landmark: this.profile.landmark,
      servicesText: this.profile.services.join(', '),
      location: this.profile.location ?? null,
    });
    this.form.markAsPristine();
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.errorMessage.set('');
    this.addressSuggestionsVisible.set(false);
    this.editCancelled.emit();
  }

  searchAddress(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const query = target.value.trim();
    this.addressQuery.set(target.value);
    this.addressSearchError.set('');
    this.addressSuggestionsVisible.set(query.length >= 3);
    this.addressSuggestions.set([]);
    this.searchingAddress.set(query.length >= 3);
    this.addressQueryInput.next(query);
  }

  selectAddress(suggestion: RegistrationAddressSuggestion): void {
    this.addressQuery.set(suggestion.label);
    this.addressSuggestionsVisible.set(false);
    this.addressSuggestions.set([]);
    this.form.patchValue({
      address: suggestion.label,
      city: suggestion.city ?? this.form.controls.city.value,
      state: suggestion.state ?? this.form.controls.state.value,
      country: suggestion.country ?? this.form.controls.country.value,
      postalCode: suggestion.postalCode ?? this.form.controls.postalCode.value,
      street: suggestion.street ?? this.form.controls.street.value,
      area: suggestion.area ?? this.form.controls.area.value,
      location: { latitude: suggestion.latitude, longitude: suggestion.longitude },
    });
  }

  clearSelectedLocation(): void {
    this.form.controls.location.setValue(null);
  }

  saveProfile(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const services = [
      ...new Set(
        values.servicesText
          .split(/[,\n]/)
          .map((service) => service.trim())
          .filter(Boolean),
      ),
    ];
    if (!services.length) {
      this.form.controls.servicesText.setErrors({ required: true });
      this.form.controls.servicesText.markAsTouched();
      return;
    }

    const update: ShopBusinessDetailsUpdate = {
      ownerFirstName: values.ownerFirstName.trim(),
      ownerLastName: values.ownerLastName.trim(),
      countryCode: values.countryCode.trim(),
      mobileNumber: values.mobileNumber.trim(),
      shopName: values.shopName.trim(),
      businessType: values.businessType.trim(),
      description: values.description.trim(),
      yearsOfExperience: values.yearsOfExperience,
      address: values.address.trim(),
      street: values.street.trim(),
      area: values.area.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      country: values.country.trim(),
      postalCode: values.postalCode.trim(),
      landmark: values.landmark.trim(),
      services,
      location: values.location,
    };
    this.saving.set(true);
    this.authService.updateMyShopBusinessDetails(update).subscribe({
      next: (profile) => {
        this.profileUpdated.emit(profile);
        this.saving.set(false);
        this.editing.set(false);
        this.successMessage.set('Your business profile has been updated.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to update your business profile.'),
        );
      },
    });
  }
}
