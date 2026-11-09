import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-overlay-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader-content" role="status" aria-live="polite" aria-label="Loading">
      <span class="loader-spinner" aria-hidden="true"></span>
      <span class="loader-title">Loading...</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .loader-content {
      display: grid;
      justify-items: center;
      gap: 0.75rem;
      color: #fff;
      text-align: center;
    }

    .loader-spinner {
      width: 4rem;
      height: 4rem;
      border: 5px solid rgb(255 255 255 / 62%);
      border-top-color: #16a34a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loader-title {
      font-size: 1.1rem;
      font-weight: 600;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .loader-spinner {
        animation-duration: 1.5s;
      }
    }
  `,
})
export class LoaderComponent {}
