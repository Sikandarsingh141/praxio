import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalPages > 1) {
      <nav class="pagination" [attr.aria-label]="ariaLabel">
        <span class="summary">Showing {{ firstItem }}–{{ lastItem }} of {{ total }}</span>
        <div class="controls">
          <button
            type="button"
            aria-label="First page"
            [disabled]="disabled || page <= 1"
            (click)="goToPage(1)"
          >
            «
          </button>
          <button
            type="button"
            aria-label="Previous page"
            [disabled]="disabled || page <= 1"
            (click)="goToPage(page - 1)"
          >
            ‹
          </button>
          @for (pageNumber of visiblePages; track pageNumber) {
            <button
              type="button"
              [class.current-page]="page === pageNumber"
              [attr.aria-current]="page === pageNumber ? 'page' : null"
              [attr.aria-label]="'Page ' + pageNumber"
              [disabled]="disabled"
              (click)="goToPage(pageNumber)"
            >
              {{ pageNumber }}
            </button>
          }
          <button
            type="button"
            aria-label="Next page"
            [disabled]="disabled || page >= totalPages"
            (click)="goToPage(page + 1)"
          >
            ›
          </button>
          <button
            type="button"
            aria-label="Last page"
            [disabled]="disabled || page >= totalPages"
            (click)="goToPage(totalPages)"
          >
            »
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      color: #52635a;
      font-size: 0.875rem;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    button {
      min-width: 2.25rem;
      min-height: 2.25rem;
      padding: 0.35rem 0.55rem;
      border: 1px solid #d6e0d8;
      border-radius: 0.5rem;
      background: #fff;
      color: #24352b;
      font: inherit;
      cursor: pointer;
    }

    button.current-page {
      border-color: #176b3a;
      background: #176b3a;
      color: #fff;
    }

    button:focus-visible {
      outline: 3px solid #80bd91;
      outline-offset: 2px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    @media (max-width: 600px) {
      .pagination {
        align-items: flex-start;
        flex-direction: column;
      }

      .controls {
        max-width: 100%;
        flex-wrap: wrap;
      }
    }
  `,
})
export class PaginationComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 5;
  @Input() disabled = false;
  @Input() ariaLabel = 'List pages';
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return this.pageSize > 0 ? Math.ceil(this.total / this.pageSize) : 0;
  }

  get firstItem(): number {
    return this.total ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get lastItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  get visiblePages(): number[] {
    const count = Math.min(5, this.totalPages);
    const firstPage = Math.max(1, Math.min(this.page - 2, this.totalPages - count + 1));
    return Array.from({ length: count }, (_, index) => firstPage + index);
  }

  goToPage(page: number): void {
    if (this.disabled || page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.pageChange.emit(page);
  }
}
