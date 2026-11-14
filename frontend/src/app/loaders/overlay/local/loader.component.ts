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
      min-width: 11rem;
      justify-items: center;
      gap: 0.85rem;
      padding: 1.5rem 1.75rem;
      // border: 1px solid #e1e9e3;
      // border-radius: 1rem;
      // background: #fff;
      // box-shadow: 0 16px 48px rgb(15 35 23 / 22%);
      color: #1f3528;
      text-align: center;
    }

    .loader-spinner {
      width: 3.5rem;
      height: 3.5rem;
      border: 5px solid #dce8df;
      border-top-color: #087c3b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loader-title {
      color: #fff;
      font-size: 1.1rem;
      font-weight: 700;
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
