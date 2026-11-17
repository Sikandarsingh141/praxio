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
      [pageSizeOptions]="pageSizeOptions"
      [disabled]="disabled"
      [variant]="variant"
      [showWhenEmpty]="showWhenEmpty"
      (pageChange)="pageChange.emit($event)"
      (pageSizeChange)="pageSizeChange.emit($event)"
    />
  `,
  styles: `:host { display: block; width: 100%; margin: 0; padding: 0; }`,
})
export class JobPaginationComponent {
  @Input() ariaLabel = 'Job list pages';
  @Input() variant: 'default' | 'brand' = 'default';
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 100];
  @Input() disabled = false;
  @Input() showWhenEmpty = false;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
}
