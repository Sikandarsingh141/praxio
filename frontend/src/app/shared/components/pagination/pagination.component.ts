import { Component, EventEmitter, Input, Output } from '@angular/core';

type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (total > pageSize) {
      <nav
        class="pagination"
        [class.brand]="variant === 'brand'"
        [attr.aria-label]="ariaLabel"
        [attr.aria-busy]="disabled"
      >
        <div class="pagination-left">
          <label class="page-size-control">
            <span class="page-size-label">Items per page:</span>
            <div class="select-wrapper">
              <select
                aria-label="Items per page"
                [disabled]="disabled"
                (change)="changePageSize($event)"
              >
                @for (size of pageSizeOptions; track size) {
                  <option [value]="size" [selected]="size === pageSize">{{ size }}</option>
                }
              </select>
              <svg class="select-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </label>
        </div>
        <div class="pagination-right">
          <span class="summary" aria-live="polite">Showing {{ firstItem }}–{{ lastItem }} of {{ total }}</span>
          <div class="controls">
            <button
              type="button"
              class="pagination-btn nav-btn first-btn"
              aria-label="First page"
              [disabled]="disabled || page <= 1"
              (click)="goToPage(1)"
            >«</button>
            <button
              type="button"
              class="pagination-btn nav-btn prev-btn"
              aria-label="Previous page"
              [disabled]="disabled || page <= 1"
              (click)="goToPage(page - 1)"
            >‹</button>
            @for (token of pageTokens; track token) {
              @if (isPageNumber(token)) {
                <button
                  type="button"
                  class="pagination-btn page-num-btn"
                  [class.current-page]="page === token"
                  [attr.aria-current]="page === token ? 'page' : null"
                  [attr.aria-label]="'Page ' + token"
                  [disabled]="disabled"
                  (click)="goToPage(token)"
                >{{ token }}</button>
              } @else {
                <span class="ellipsis" aria-hidden="true">…</span>
              }
            }
            <button
              type="button"
              class="pagination-btn nav-btn next-btn"
              aria-label="Next page"
              [disabled]="disabled || page >= totalPages"
              (click)="goToPage(page + 1)"
            >›</button>
            <button
              type="button"
              class="pagination-btn nav-btn last-btn"
              aria-label="Last page"
              [disabled]="disabled || page >= totalPages"
              (click)="goToPage(totalPages)"
              [attr.aria-label]="'Last page, page ' + totalPages"
            >»</button>
          </div>
        </div>
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
    }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      background: #f6faf7;
      border-top: 1px solid #e4ede6;
      border-bottom-left-radius: inherit;
      border-bottom-right-radius: inherit;
      color: #27362b;
      font-size: 0.8125rem;
      box-sizing: border-box;
      width: 100%;
    }
    .pagination-left,
    .pagination-right,
    .page-size-control,
    .controls {
      display: flex;
      align-items: center;
    }
    .page-size-control {
      gap: 0.55rem;
      color: #27362b;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .page-size-label {
      color: #27362b;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .select-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .select-wrapper select {
      min-height: 2.15rem;
      height: 2.15rem;
      padding: 0 1.85rem 0 0.75rem;
      border: 1px solid #d3ded6;
      border-radius: 0.5rem;
      background: #fff;
      color: #17212b;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .select-wrapper select:focus-visible {
      outline: 2px solid #8abd94;
      outline-offset: 1px;
      border-color: #087c3b;
    }
    .select-arrow {
      position: absolute;
      right: 0.55rem;
      width: 0.9rem;
      height: 0.9rem;
      pointer-events: none;
      color: #55695b;
    }
    .pagination-right {
      gap: 1.25rem;
      margin-left: auto;
    }
    .summary {
      color: #27362b;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .controls {
      gap: 0.35rem;
    }
    .pagination-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.15rem;
      height: 2.15rem;
      padding: 0 0.5rem;
      border: 1px solid #dfe7e1;
      border-radius: 0.45rem;
      background: #fff;
      color: #27362b;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      box-sizing: border-box;
      transition: all 0.15s ease;
    }
    .pagination-btn:not(.current-page):not(:disabled):hover {
      border-color: #8abd94;
      background: #eef7f0;
      color: #087c3b;
    }
    .pagination-btn.current-page {
      border-color: #087c3b;
      background: #087c3b;
      color: #fff;
      font-weight: 700;
    }
    .pagination-btn:disabled {
      border-color: #e5ece7;
      background: #fff;
      color: #cbd5e1;
      cursor: not-allowed;
      opacity: 0.65;
    }
    .pagination-btn:focus-visible {
      outline: 2px solid #8abd94;
      outline-offset: 1px;
    }
    .ellipsis {
      min-width: 1.3rem;
      text-align: center;
      color: #788a7e;
      font-weight: 600;
    }
    @media (max-width: 768px) {
      .pagination {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
      }
      .pagination-right {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.65rem;
        margin-left: 0;
      }
      .controls {
        flex-wrap: wrap;
      }
    }
    @media (max-width: 480px) {
      .pagination-right {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .controls {
        width: 100%;
        justify-content: flex-start;
      }
      .pagination-btn {
        min-width: 1.95rem;
        height: 1.95rem;
        font-size: 0.75rem;
      }
    }
  `,
})
export class PaginationComponent {
  @Input() variant: 'default' | 'brand' = 'default';
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 100];
  @Input() disabled = false;
  @Input() showWhenEmpty = false;
  @Input() ariaLabel = 'List pages';
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get totalPages(): number { return this.pageSize > 0 ? Math.ceil(this.total / this.pageSize) : 0; }
  get firstItem(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get lastItem(): number { return Math.min(this.page * this.pageSize, this.total); }

  get pageTokens(): PageToken[] {
    const count = this.totalPages;
    if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
    if (this.page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', count];
    if (this.page >= count - 3) return [1, 'ellipsis-start', count - 4, count - 3, count - 2, count - 1, count];
    return [1, 'ellipsis-start', this.page - 1, this.page, this.page + 1, 'ellipsis-end', count];
  }

  isPageNumber(token: PageToken): token is number { return typeof token === 'number'; }

  changePageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!this.disabled && this.pageSizeOptions.includes(size) && size !== this.pageSize) this.pageSizeChange.emit(size);
  }

  goToPage(page: number): void {
    if (!this.disabled && page >= 1 && page <= this.totalPages && page !== this.page) this.pageChange.emit(page);
  }
}
