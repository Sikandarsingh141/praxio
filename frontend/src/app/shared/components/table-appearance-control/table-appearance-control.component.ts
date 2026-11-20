import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { getAuthErrorMessage } from '../../../core/auth/auth-error-message';

@Component({
  selector: 'app-table-appearance-control',
  standalone: true,
  template: `
    <section class="table-appearance-card" aria-labelledby="table-appearance-title">
      <div>
        <h2 id="table-appearance-title">Table appearance</h2>
        <p>Choose whether tables use curved scroll-edge indicators or a normal view.</p>
        @if (errorMessage()) {
          <p class="table-appearance-error" role="alert">{{ errorMessage() }}</p>
        } @else if (saved()) {
          <p class="table-appearance-success" role="status">Your table preference was saved.</p>
        }
      </div>
      <div class="table-appearance-options" role="group" aria-label="Table appearance">
        <button
          type="button"
          [attr.aria-pressed]="appearance() === 'curved'"
          [class.selected]="appearance() === 'curved'"
          [disabled]="saving()"
          (click)="setAppearance('curved')"
        >
          Curved
        </button>
        <button
          type="button"
          [attr.aria-pressed]="appearance() === 'normal'"
          [class.selected]="appearance() === 'normal'"
          [disabled]="saving()"
          (click)="setAppearance('normal')"
        >
          Normal
        </button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }

    .table-appearance-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.15rem;
      border: 1px solid #e3e9e5;
      border-radius: 0.9rem;
      background: #fff;
      box-shadow: 0 2px 8px rgb(22 43 29 / 4%);
    }

    .table-appearance-card > div:first-child {
      min-width: 0;
    }

    h2 {
      margin: 0;
      color: #17271d;
      font-size: 0.95rem;
    }

    p {
      margin: 0.35rem 0 0;
      color: #66756b;
      font-size: 0.75rem;
    }

    .table-appearance-options {
      display: inline-flex;
      flex: 0 0 auto;
      gap: 0.25rem;
      padding: 0.25rem;
      border: 1px solid #dfe7e1;
      border-radius: 0.75rem;
      background: #f5f8f5;
    }

    button {
      min-width: 5rem;
      padding: 0.55rem 0.75rem;
      border: 0;
      border-radius: 0.55rem;
      background: transparent;
      color: #526157;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }

    button.selected {
      background: #087c3b;
      color: #fff;
      box-shadow: 0 1px 3px rgb(13 64 34 / 16%);
    }

    button:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .table-appearance-error {
      color: #b42318;
    }

    .table-appearance-success {
      color: #087c3b;
    }

    @media (max-width: 600px) {
      .table-appearance-card {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class TableAppearanceControlComponent {
  private readonly auth = inject(AuthService);
  readonly appearance = computed(
    () => this.auth.currentUser()?.tableAppearance ?? 'curved',
  );
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');

  setAppearance(tableAppearance: 'curved' | 'normal'): void {
    if (this.saving() || this.appearance() === tableAppearance) return;

    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    this.auth
      .updateMyTableAppearance(tableAppearance)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.saved.set(true),
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Your table preference could not be saved.'),
          ),
      });
  }
}
