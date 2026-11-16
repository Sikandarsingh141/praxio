import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonFilterComponent, FilterConfig, FilterValues } from './common-filter.component';

describe('CommonFilterComponent', () => {
  let fixture: ComponentFixture<CommonFilterComponent>;
  let component: CommonFilterComponent;
  const config: FilterConfig = {
    title: 'Test filters',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
        ],
      },
      { key: 'created', label: 'Created date', type: 'date-range' },
      { key: 'amount', label: 'Amount', type: 'number-range' },
      {
        key: 'tags',
        label: 'Tags',
        type: 'multi-select',
        options: [
          { label: 'Repair', value: 'repair' },
          { label: 'Warranty', value: 'warranty' },
        ],
      },
      { key: 'urgent', label: 'Urgent only', type: 'checkbox' },
      {
        key: 'rating',
        label: 'Rating',
        type: 'radio',
        options: [
          { label: 'Five stars', value: 5 },
          { label: 'Four stars', value: 4 },
        ],
      },
      { key: 'query', label: 'Text search', type: 'text' },
      { key: 'singleDate', label: 'Single date', type: 'date' },
      { key: 'count', label: 'Count', type: 'number' },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonFilterComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CommonFilterComponent);
    component = fixture.componentInstance;
    component.config = config;
    fixture.detectChanges();
  });

  it('opens the right-side drawer and closes it with Escape', () => {
    const trigger = fixture.nativeElement.querySelector('.filter-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(component.drawerOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    component.onEscape();
    fixture.detectChanges();
    expect(component.drawerOpen).toBe(false);
  });

  it('does not apply draft changes until Apply filters is clicked', () => {
    const changes = jasmine.createSpy('filtersChange');
    component.filtersChange.subscribe(changes);
    component.toggleDrawer();
    component.updateValue('status', 'open');
    component.closeDrawer();

    expect(changes).not.toHaveBeenCalled();
    expect(component.activeFilterCount).toBe(0);

    component.toggleDrawer();
    component.updateValue('status', 'open');
    component.updateRange('created', 'from', '2026-01-01');
    component.updateNumberRange('amount', 'min', '100');
    component.updateValue('tags', ['repair', 'warranty']);
    component.updateValue('urgent', true);
    component.updateValue('rating', 5);
    component.updateValue('query', 'washing machine');
    component.updateValue('singleDate', '2026-02-01');
    component.updateNumber('count', '3');
    component.applyFilters();

    expect(changes).toHaveBeenCalledOnceWith({
      status: 'open',
      created: { from: '2026-01-01' },
      amount: { min: 100 },
      tags: ['repair', 'warranty'],
      urgent: true,
      rating: 5,
      query: 'washing machine',
      singleDate: '2026-02-01',
      count: 3,
    } satisfies FilterValues);
    expect(component.activeFilterCount).toBe(9);
  });

  it('removes one applied chip and clears all applied filters', () => {
    const changes = jasmine.createSpy('filtersChange');
    component.filtersChange.subscribe(changes);
    component.appliedFilters = { status: 'open', query: 'phone' };
    fixture.detectChanges();

    expect(component.activeFilterCount).toBe(2);
    component.removeFilter('status');
    expect(changes).toHaveBeenCalledWith({ query: 'phone' });
    expect(component.activeFilterCount).toBe(1);

    component.clearApplied();
    expect(changes).toHaveBeenCalledWith({});
    expect(component.activeFilterCount).toBe(0);
  });

  it('clears only draft selections while keeping the drawer open', () => {
    component.toggleDrawer();
    component.updateValue('status', 'closed');
    component.clearDraft();

    expect(component.drawerOpen).toBe(true);
    expect(component.textValue('status')).toBe('');
  });
});
