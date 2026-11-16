import { Component, EventEmitter, Input, Output } from '@angular/core';

type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (total > 0 || showWhenEmpty) {
      <nav class="pagination" [attr.aria-label]="ariaLabel" [attr.aria-busy]="disabled">
        <label class="page-size-control">
          <span>Items per page</span>
          <select
            aria-label="Items per page"
            [disabled]="disabled"
            (change)="changePageSize($event)"
          >
            @for (size of pageSizeOptions; track size) {
              <option [value]="size" [selected]="size === pageSize">{{ size }}</option>
            }
          </select>
        </label>
        <div class="pagination-right">
          <span class="summary" aria-live="polite">{{ firstItem }}–{{ lastItem }} of {{ total }}</span>
          <div class="controls">
            <button type="button" aria-label="First page" [disabled]="disabled || page <= 1" (click)="goToPage(1)">«</button>
            <button type="button" aria-label="Previous page" [disabled]="disabled || page <= 1" (click)="goToPage(page - 1)">‹</button>
            @for (token of pageTokens; track token) {
              @if (isPageNumber(token)) {
                <button
                  type="button"
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
            <button type="button" aria-label="Next page" [disabled]="disabled || page >= totalPages" (click)="goToPage(page + 1)">›</button>
            <button type="button" aria-label="Last page" [disabled]="disabled || page >= totalPages" (click)="goToPage(totalPages)" [attr.aria-label]="'Last page, page ' + totalPages">»</button>
          </div>
        </div>
      </nav>
    }
  `,
  styles: `
    :host { display: block; margin-top: 1rem; }
    .pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: #475569; font-size: .875rem; }
    .page-size-control, .pagination-right, .controls { display: flex; align-items: center; }
    .page-size-control { gap: .55rem; white-space: nowrap; }
    select, button { min-height: 2.35rem; border: 1px solid #d7dee8; border-radius: .5rem; background: #fff; color: #334155; font: inherit; }
    select { padding: 0 .65rem; cursor: pointer; }
    .pagination-right { gap: 1rem; }
    .summary { white-space: nowrap; }
    .controls { gap: .3rem; }
    button { min-width: 2.35rem; padding: .35rem .55rem; cursor: pointer; }
    button.current-page { border-color: #2563eb; background: #2563eb; color: #fff; }
    button:focus-visible, select:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    button:disabled, select:disabled { cursor: not-allowed; opacity: .45; }
    .ellipsis { min-width: 1.3rem; text-align: center; }
    @media (max-width: 700px) {
      .pagination { align-items: flex-start; flex-direction: column; }
      .pagination-right { width: 100%; align-items: flex-start; flex-direction: column; gap: .55rem; }
      .controls { max-width: 100%; flex-wrap: wrap; }
    }
    @media (max-width: 380px) { .controls { gap: .2rem; } button { min-width: 2rem; min-height: 2rem; padding: .25rem; } }
  `,
})
export class PaginationComponent {
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
