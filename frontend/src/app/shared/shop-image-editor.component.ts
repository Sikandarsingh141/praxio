import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AuthService } from '../core/auth/auth.service';

const SHOP_IMAGE_MAX_BYTES = 1024 * 1024;
const SHOP_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-shop-image-editor',
  standalone: true,
  template: `
    <section class="shop-image-editor" aria-labelledby="shop-image-title">
      <div class="editor-heading">
        <div>
          <span class="section-eyebrow">SHOP BRANDING</span>
          <h2 id="shop-image-title">Shop image</h2>
          <p>Update the image customers see for your business.</p>
        </div>
      </div>
      <div class="image-row">
        @if (imageData) {
          <img class="shop-image" [src]="imageData" alt="Shop image preview" />
        } @else {
          <span class="shop-image image-placeholder" aria-hidden="true">
            {{ shopInitial() }}
          </span>
        }
        <div class="image-controls">
          <span class="image-hint">JPEG, PNG, or WebP · up to 1 MB</span>
          <label class="upload-button" [class.disabled]="saving()">
            {{ saving() ? 'Uploading…' : imageData ? 'Change shop image' : 'Add shop image' }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              [disabled]="saving()"
              (change)="uploadImage($event)"
            />
          </label>
        </div>
      </div>
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
      margin: 0 0 1rem;
    }

    .shop-image-editor {
      display: grid;
      gap: 1rem;
      padding: clamp(1rem, 2vw, 1.25rem);
      border: 1px solid #e1e6e3;
      border-radius: 0.95rem;
      background: #fff;
      box-shadow: 0 2px 8px rgb(20 40 28 / 5%);
    }

    .section-eyebrow {
      color: #63806d;
      font-size: 0.65rem;
      font-weight: 750;
      letter-spacing: 0.1em;
    }

    h2 {
      margin: 0.2rem 0 0;
      color: #18221d;
      font-size: 1rem;
      font-weight: 760;
    }

    .editor-heading p {
      margin: 0.25rem 0 0;
      color: #647169;
      font-size: 0.75rem;
    }

    .image-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .shop-image {
      display: grid;
      width: 5rem;
      height: 5rem;
      flex: 0 0 5rem;
      place-items: center;
      border: 1px solid #d5e4d9;
      border-radius: 0.8rem;
      object-fit: cover;
    }

    .image-placeholder {
      background: #edf4ee;
      color: #087c3b;
      font-size: 1.6rem;
      font-weight: 750;
    }

    .image-controls {
      display: grid;
      justify-items: start;
      gap: 0.35rem;
    }

    .image-hint {
      color: #84918a;
      font-size: 0.72rem;
    }

    .upload-button {
      display: inline-flex;
      min-height: 2.4rem;
      align-items: center;
      justify-content: center;
      margin-top: 0.2rem;
      padding: 0.45rem 0.8rem;
      border: 1px solid #087c3b;
      border-radius: 0.55rem;
      background: #087c3b;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 650;
    }

    .upload-button input {
      display: none;
    }

    .upload-button.disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .feedback {
      margin: 0;
      font-size: 0.76rem;
    }

    .feedback.error {
      color: #a63d34;
    }

    .feedback.success {
      color: #39704a;
    }
  `,
})
export class ShopImageEditorComponent {
  private readonly authService = inject(AuthService);
  @Input() imageData?: string;
  @Input() shopName = '';
  @Output() readonly imageUpdated = new EventEmitter<string>();
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  shopInitial(): string {
    return this.shopName.trim().slice(0, 1).toUpperCase() || 'S';
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
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!SHOP_IMAGE_TYPES.has(image.type) || image.size > SHOP_IMAGE_MAX_BYTES) {
      this.errorMessage.set('Choose a JPEG, PNG, or WebP image smaller than 1 MB.');
      return;
    }

    this.saving.set(true);
    this.authService.uploadMyShopImage(image).subscribe({
      next: (profile) => {
        this.saving.set(false);
        if (profile.shopImageData) {
          this.imageData = profile.shopImageData;
          this.imageUpdated.emit(profile.shopImageData);
        }
        this.successMessage.set('Your shop image has been updated.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to upload your shop image.'),
        );
      },
    });
  }
}
