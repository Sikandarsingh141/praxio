import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';

const PROFILE_IMAGE_MAX_BYTES = 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  template: `
    <section class="profile-editor" aria-labelledby="profile-editor-title">
      <div class="editor-heading">
        <span class="editor-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <div>
          <h2 id="profile-editor-title">Profile details</h2>
          <p>Update your name and profile photo.</p>
        </div>
      </div>

      <div class="profile-photo-row">
        @if (authService.currentUser()?.profileImageUrl; as imageUrl) {
          <img class="profile-photo" [src]="imageUrl" alt="Your profile photo" />
        } @else {
          <span class="profile-photo photo-placeholder" aria-hidden="true">
            {{ initials() }}
          </span>
        }
        <div class="photo-controls">
          <strong>{{ displayName() || 'Your profile photo' }}</strong>
          <span>JPEG, PNG, or WebP · up to 1 MB</span>
          <label class="upload-button" [class.disabled]="savingImage()">
            {{ savingImage() ? 'Uploading…' : 'Change photo' }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              [disabled]="savingImage()"
              (change)="uploadImage($event)"
            />
          </label>
        </div>
      </div>

      <form class="name-form" (submit)="saveName($event)">
        <div class="name-controls">
          <label for="profile-first-name">
            First Name
            <input
              id="profile-first-name"
              name="firstName"
              type="text"
              maxlength="50"
              autocomplete="given-name"
              [value]="firstName()"
              [disabled]="savingName()"
              (input)="setFirstName($event)"
              required
            />
          </label>
          <label for="profile-last-name">
            Last Name
            <input
              id="profile-last-name"
              name="lastName"
              type="text"
              maxlength="50"
              autocomplete="family-name"
              [value]="lastName()"
              [disabled]="savingName()"
              (input)="setLastName($event)"
              required
            />
          </label>
          <button
            type="submit"
            [disabled]="savingName() || !firstName().trim() || !lastName().trim()"
          >
            {{ savingName() ? 'Saving…' : 'Save name' }}
          </button>
        </div>
      </form>

      @if (allowPasswordChange) {
        <form class="password-form" (submit)="changePassword($event)">
          <div class="password-heading">
            <h2>Change password</h2>
            <p>Choose a new password you do not use elsewhere.</p>
          </div>
          <label>
            Current password
            <input
              type="password"
              name="currentPassword"
              autocomplete="current-password"
              [value]="currentPassword()"
              (input)="setPasswordField('current', $event)"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="newPassword"
              autocomplete="new-password"
              [value]="newPassword()"
              (input)="setPasswordField('new', $event)"
              required
              minlength="8"
            />
            <small>At least 8 characters, including uppercase, lowercase, and a number.</small>
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              name="confirmPassword"
              autocomplete="new-password"
              [value]="confirmPassword()"
              (input)="setPasswordField('confirm', $event)"
              required
            />
          </label>
          @if (passwordError()) {
            <p class="feedback error" role="alert">{{ passwordError() }}</p>
          }
          @if (passwordSuccess()) {
            <p class="feedback success" role="status">{{ passwordSuccess() }}</p>
          }
          <button
            class="password-save"
            type="submit"
            [disabled]="
              savingPassword() || !currentPassword() || !newPassword() || !confirmPassword()
            "
          >
            {{ savingPassword() ? 'Updating…' : 'Update password' }}
          </button>
        </form>
      }

      @if (errorMessage()) {
        <p class="feedback error" role="alert">{{ errorMessage() }}</p>
      }
      @if (successMessage()) {
        <p class="feedback success" role="status">{{ successMessage() }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .profile-editor {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1.65fr);
      align-items: center;
      gap: 0.9rem 1rem;
      margin: 0 0 1rem;
      padding: clamp(1rem, 2vw, 1.25rem);
      border: 1px solid #e1e6e3;
      border-radius: 0.95rem;
      background: #fff;
      box-shadow: 0 2px 8px rgb(20 40 28 / 5%);
    }

    .editor-heading {
      display: flex;
      grid-column: 1 / -1;
      align-items: center;
      gap: 0.75rem;
    }

    .editor-icon {
      display: grid;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 0.65rem;
      background: #d9f6df;
      color: #078132;
    }

    .editor-icon svg {
      width: 1.4rem;
      height: 1.4rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    h2 {
      margin: 0;
      color: #18221d;
      font-size: 1rem;
      font-weight: 760;
    }

    .editor-heading p {
      margin: 0.2rem 0 0;
      color: #647169;
      font-size: 0.72rem;
    }

    .profile-photo-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      grid-column: 1 / 3;
      min-width: 0;
      margin: 0;
      padding-right: 1rem;
      border-right: 1px solid #e5ebe6;
    }

    .profile-photo {
      display: grid;
      width: 4rem;
      height: 4rem;
      flex: 0 0 4rem;
      place-items: center;
      border: 1px solid #d5e4d9;
      border-radius: 50%;
      object-fit: cover;
    }

    .photo-placeholder {
      background: #edf4ee;
      color: #315d4b;
      font-size: 1.2rem;
      font-weight: 750;
    }

    .photo-controls {
      display: grid;
      justify-items: start;
      gap: 0.25rem;
    }

    .photo-controls strong {
      color: #354a56;
      font-size: 0.84rem;
    }

    .photo-controls > span {
      color: #84918a;
      font-size: 0.7rem;
    }

    .upload-button,
    .name-controls button {
      display: inline-flex;
      min-height: 2.35rem;
      align-items: center;
      justify-content: center;
      margin-top: 0.3rem;
      padding: 0.45rem 0.75rem;
      border: 1px solid #dfe7df;
      border-radius: 0.55rem;
      background: #fff;
      color: #365a45;
      cursor: pointer;
      font: inherit;
      font-size: 0.74rem;
      font-weight: 650;
    }

    .upload-button input {
      display: none;
    }

    .upload-button.disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .name-form {
      display: grid;
      gap: 0.4rem;
      grid-column: 3;
      min-width: 0;
    }

    .name-form > label {
      color: #526057;
      font-size: 0.73rem;
    }

    .name-controls {
      display: flex;
      gap: 0.55rem;
    }

    .name-controls input {
      width: 100%;
      min-width: 0;
      min-height: 2.45rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid #dfe6ea;
      border-radius: 0.55rem;
      color: #18221d;
      font: inherit;
      font-size: 0.8rem;
    }

    .name-controls button {
      flex: 0 0 auto;
      margin: 0;
      border-color: #087c3b;
      background: #087c3b;
      color: #fff;
    }

    .feedback {
      grid-column: 1 / -1;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .feedback {
      margin: 0.8rem 0 0;
      font-size: 0.76rem;
    }

    .feedback.error {
      color: #a63d34;
    }

    .feedback.success {
      color: #39704a;
    }

    .password-form {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      grid-column: 1 / -1;
      padding-top: 1rem;
      border-top: 1px solid #e5ebe6;
    }

    .password-heading {
      grid-column: 1 / -1;
    }

    .password-heading h2 {
      font-size: 0.9rem;
    }

    .password-heading p,
    .password-form label small {
      margin: 0.2rem 0 0;
      color: #738078;
      font-size: 0.68rem;
    }

    .password-form label {
      display: grid;
      align-content: start;
      gap: 0.35rem;
      color: #526057;
      font-size: 0.73rem;
    }

    .password-form input {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.45rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid #dfe6ea;
      border-radius: 0.55rem;
      color: #18221d;
      font: inherit;
      font-size: 0.8rem;
    }

    .password-save {
      min-height: 2.35rem;
      justify-self: start;
      padding: 0.45rem 0.75rem;
      border: 1px solid #087c3b;
      border-radius: 0.55rem;
      background: #087c3b;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-size: 0.74rem;
      font-weight: 650;
    }

    .password-form .feedback {
      align-self: center;
    }

    .password-form .feedback,
    .password-save {
      grid-column: 1 / -1;
    }

    @media (max-width: 820px) {
      .profile-editor {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .profile-photo-row {
        grid-column: 1;
      }

      .name-form {
        grid-column: 2;
      }
    }

    @media (max-width: 560px) {
      .profile-editor {
        grid-template-columns: 1fr;
      }

      .profile-photo-row,
      .name-form,
      .password-form {
        grid-column: 1;
      }

      .password-form {
        grid-template-columns: 1fr;
      }

      .profile-photo-row {
        padding: 0 0 0.8rem;
        border-right: 0;
        border-bottom: 1px solid #e5ebe6;
      }

      .name-controls {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `,
})
export class ProfileEditorComponent implements OnInit {
  @Input() allowPasswordChange = false;
  readonly authService = inject(AuthService);
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly savingName = signal(false);
  readonly savingImage = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly savingPassword = signal(false);
  readonly passwordError = signal('');
  readonly passwordSuccess = signal('');

  ngOnInit(): void {
    const user = this.authService.currentUser();
    this.firstName.set(user?.firstName ?? '');
    this.lastName.set(user?.lastName ?? '');
  }

  displayName(): string {
    return [this.firstName(), this.lastName()].filter(Boolean).join(' ');
  }

  initials(): string {
    const firstName = this.authService.currentUser()?.firstName?.trim();
    return firstName ? firstName.slice(0, 1).toUpperCase() : 'P';
  }

  setFirstName(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.firstName.set(target.value);
    }
  }

  setLastName(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.lastName.set(target.value);
    }
  }

  saveName(event: Event): void {
    event.preventDefault();
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    if (this.savingName() || !firstName || !lastName) {
      return;
    }

    this.startRequest();
    this.savingName.set(true);
    this.authService.updateMyProfile(firstName, lastName).subscribe({
      next: () => {
        this.savingName.set(false);
        this.successMessage.set('Your name has been updated.');
      },
      error: (error: unknown) => {
        this.savingName.set(false);
        this.errorMessage.set(getAuthErrorMessage(error, 'Unable to update your name.'));
      },
    });
  }

  uploadImage(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const image = target.files?.[0];
    target.value = '';
    if (!image) {
      return;
    }
    if (!PROFILE_IMAGE_TYPES.has(image.type) || image.size > PROFILE_IMAGE_MAX_BYTES) {
      this.startRequest();
      this.errorMessage.set('Choose a JPEG, PNG, or WebP image smaller than 1 MB.');
      return;
    }

    this.startRequest();
    this.savingImage.set(true);
    this.authService.uploadMyProfileImage(image).subscribe({
      next: () => {
        this.savingImage.set(false);
        this.successMessage.set('Your profile photo has been updated.');
      },
      error: (error: unknown) => {
        this.savingImage.set(false);
        this.errorMessage.set(getAuthErrorMessage(error, 'Unable to upload your profile photo.'));
      },
    });
  }

  setPasswordField(field: 'current' | 'new' | 'confirm', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const update = {
      current: this.currentPassword,
      new: this.newPassword,
      confirm: this.confirmPassword,
    }[field];
    update.set(target.value);
    this.passwordError.set('');
    this.passwordSuccess.set('');
  }

  changePassword(event: Event): void {
    event.preventDefault();
    if (this.savingPassword()) return;
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('The new passwords do not match.');
      this.passwordSuccess.set('');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(this.newPassword())) {
      this.passwordError.set(
        'Use 8–72 characters with at least one uppercase letter, lowercase letter, and number.',
      );
      this.passwordSuccess.set('');
      return;
    }

    this.passwordError.set('');
    this.passwordSuccess.set('');
    this.savingPassword.set(true);
    this.authService.changeMyPassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordSuccess.set('Your password has been updated.');
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        this.passwordError.set(getAuthErrorMessage(error, 'Unable to update your password.'));
      },
    });
  }

  private startRequest(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }
}
