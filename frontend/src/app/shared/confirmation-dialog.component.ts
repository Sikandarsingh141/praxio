import { Component, HostListener, input, output, signal } from '@angular/core';

export interface ConfirmationDialogConfig {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  template: `
    @if (config(); as dialog) {
      <div class="dialog-backdrop" (click)="cancel()">
        <section
          class="dialog-panel"
          [class.destructive]="dialog.destructive"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-message"
          (click)="$event.stopPropagation()"
        >
          <h2 id="confirmation-dialog-title">{{ dialog.title }}</h2>
          <p id="confirmation-dialog-message">{{ dialog.message }}</p>

          @if (dialog.reasonLabel) {
            <label class="reason-field">
              <span>{{ dialog.reasonLabel }}</span>
              <textarea
                #reasonInput
                rows="3"
                maxlength="500"
                [placeholder]="dialog.reasonPlaceholder ?? ''"
                [required]="dialog.reasonRequired ?? false"
                (input)="updateReason($event)"
              ></textarea>
            </label>
            @if (reasonError()) {
              <p class="reason-error" role="alert">Enter a reason before continuing.</p>
            }
          }

          <div class="dialog-actions">
            <button type="button" class="cancel-button" (click)="cancel()">
              {{ dialog.cancelLabel }}
            </button>
            <button
              #confirmButton
              type="button"
              class="confirm-button"
              [class.destructive]="dialog.destructive"
              (click)="confirm()"
            >
              {{ dialog.confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styleUrl: './confirmation-dialog.component.scss',
})
export class ConfirmationDialogComponent {
  readonly config = input.required<ConfirmationDialogConfig>();
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();
  readonly reasonError = signal(false);
  private readonly reason = signal('');

  updateReason(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.reason.set(target.value);
      this.reasonError.set(false);
    }
  }

  confirm(): void {
    const dialog = this.config();
    const reason = this.reason().trim();
    if (dialog.reasonRequired && !reason) {
      this.reasonError.set(true);
      return;
    }
    this.confirmed.emit(reason);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }
}
