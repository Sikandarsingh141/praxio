import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-job-filters',
  standalone: true,
  template: `
    <div class="job-filters">
      <label class="search-control">
        <span class="visually-hidden">Search jobs</span>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search jobs, devices, customers..."
          [value]="search"
          (input)="searchChange.emit($any($event.target).value)"
        />
      </label>
      <label class="sort-control">
        <span>Sort by</span>
        <select [value]="sort" (change)="sortChange.emit($any($event.target).value)">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      @if (showStatusFilter) {
        <label class="sort-control">
          <span>Status</span>
          <select
            [value]="statusFilter"
            (change)="statusFilterChange.emit($any($event.target).value)"
          >
            <option value="">All statuses</option>
            @for (status of statusOptions; track status) {
              <option [value]="status">{{ status.replaceAll('_', ' ') }}</option>
            }
          </select>
        </label>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .job-filters { display: flex; justify-content: space-between; gap: .75rem; padding: .85rem; border: 1px solid #e3e9e4; border-radius: .85rem; background: #fff; }
    .search-control, .sort-control { display: flex; align-items: center; gap: .55rem; min-height: 2.7rem; }
    .search-control { flex: 1; min-width: 12rem; padding: 0 .7rem; border: 1px solid #dfe6e1; border-radius: .6rem; color: #647169; }
    input, select { min-width: 0; border: 0; outline: 0; background: transparent; color: #20302b; font: inherit; }
    input { width: 100%; }
    .sort-control { color: #647169; font-size: .85rem; }
    select { min-height: 2.6rem; padding: 0 .7rem; border: 1px solid #dfe6e1; border-radius: .6rem; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    @media (max-width: 620px) { .job-filters { flex-direction: column; } .sort-control { justify-content: space-between; } }
  `,
})
export class JobFiltersComponent {
  @Input() search = '';
  @Input() sort: 'newest' | 'oldest' = 'newest';
  @Input() statusFilter = '';
  @Input() statusOptions: string[] = [];
  @Input() showStatusFilter = true;
  @Output() searchChange = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<'newest' | 'oldest'>();
  @Output() statusFilterChange = new EventEmitter<string>();
}
