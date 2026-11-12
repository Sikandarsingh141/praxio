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
        <form [formGroup]="form" (ngSubmit)="saveAddress()">
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
              First Name
              <input
                [value]="profile.ownerFirstName"
                readonly
                aria-label="First name (read only)"
              />
            </label>
            <label>
              Last Name
              <input
                [value]="profile.ownerLastName"
                readonly
                aria-label="Last name (read only)"
              />
            </label>
            <label>
              Email Address
              <input [value]="profile.email" readonly aria-label="Email address (read only)" />
            </label>
            <label>
              Phone Number
              <input
                [value]="profile.countryCode + ' ' + profile.mobileNumber"
                readonly
                aria-label="Phone number (read only)"
              />
            </label>
            <label>
              Business Type
              <input
                [value]="profile.businessType"
                readonly
                aria-label="Business type (read only)"
              />
            </label>
            <label>
              Experience
              <input
                [value]="
                  profile.yearsOfExperience + (profile.yearsOfExperience === 1 ? ' year' : ' years')
                "
                readonly
                aria-label="Experience (read only)"
              />
            </label>
            <h2 class="form-section-heading wide">
              <span aria-hidden="true">⌖</span> Business Address Information
            </h2>
            <label class="wide address-search">
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
              <textarea formControlName="address" rows="2" maxlength="200"></textarea>
              @if (form.controls.address.touched && form.controls.address.invalid) {
                <small class="field-error">Enter an address.</small>
              }
            </label>
            <label>
              Country
              <input
                [value]="profile.country || 'Not provided'"
                readonly
                aria-label="Country (read only)"
              />
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
    shopName: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    address: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    city: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    state: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    postalCode: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[\p{L}\d -]{3,12}$/u),
    ]),
    landmark: this.formBuilder.nonNullable.control('', Validators.maxLength(150)),
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
      shopName: this.profile.shopName,
      address: this.profile.address,
      city: this.profile.city,
      state: this.profile.state,
      postalCode: this.profile.postalCode,
      landmark: this.profile.landmark,
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
      postalCode: suggestion.postalCode ?? this.form.controls.postalCode.value,
      location: { latitude: suggestion.latitude, longitude: suggestion.longitude },
    });
  }

  saveAddress(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const update: ShopBusinessDetailsUpdate = values;
    this.saving.set(true);
    this.authService.updateMyShopBusinessDetails(update).subscribe({
      next: (profile) => {
        this.profileUpdated.emit(profile);
        this.saving.set(false);
        this.editing.set(false);
        this.successMessage.set('Your shop name and address have been updated.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to update your shop name and address.'),
        );
      },
    });
  }
}
