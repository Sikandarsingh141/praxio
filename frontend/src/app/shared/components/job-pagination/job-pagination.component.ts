import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PaginationComponent } from '../pagination/pagination.component';

@Component({
  selector: 'app-job-pagination',
  standalone: true,
  imports: [PaginationComponent],
  template: `
    <app-pagination
      [ariaLabel]="ariaLabel"
      [total]="total"
      [page]="page"
      [pageSize]="pageSize"
      [disabled]="disabled"
      [variant]="variant"
      (pageChange)="pageChange.emit($event)"
      (pageSizeChange)="pageSizeChange.emit($event)"
    />
  `,
  styles: `:host { display: block; }`,
})
export class JobPaginationComponent {
  @Input() ariaLabel = 'Job list pages';
  @Input() variant: 'default' | 'brand' = 'default';
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() disabled = false;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
}
