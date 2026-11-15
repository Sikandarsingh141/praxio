import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { ToastItem, ToastType } from './toast.models';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast-card"
          [class]="'toast-' + toast.type"
          [class.closing]="toast.closing"
          (mouseenter)="toastService.pause(toast.id)"
          (mouseleave)="toastService.resume(toast.id)"
          role="alert"
        >
          <div class="toast-body">
            <!-- Icon -->
            <div class="toast-icon-wrap" [attr.aria-hidden]="true">
              @switch (toast.type) {
                @case ('success') {
                  <svg class="toast-icon icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" fill="#16a34a" stroke="none" />
                    <path d="m8 12 3 3 5-6" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
                @case ('error') {
                  <svg class="toast-icon icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="none" />
                    <path d="M12 8v5M12 16.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
                @case ('warning') {
                  <svg class="toast-icon icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" fill="#ea580c" stroke="none" />
                    <path d="M12 8v5M12 16.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
                @case ('info') {
                  <svg class="toast-icon icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="none" />
                    <path d="M12 11v6M12 7.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
              }
            </div>

            <!-- Content -->
            <div class="toast-content">
              <h4 class="toast-title">{{ toast.title }}</h4>
              @if (toast.message) {
                <p class="toast-message">{{ toast.message }}</p>
              }
            </div>

            <!-- Close Button -->
            <button
              type="button"
              class="toast-close-btn"
              (click)="toastService.dismiss(toast.id)"
              aria-label="Close notification"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Progress Bar -->
          <div class="toast-progress-track">
            <div
              class="toast-progress-bar"
              [style.width.%]="toast.progressPercent"
            ></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./toast-container.component.scss'],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
