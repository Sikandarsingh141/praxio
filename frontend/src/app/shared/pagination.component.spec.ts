import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.pageSize = 5;
  });

  it('hides controls when the record count is five or fewer', () => {
    fixture.componentInstance.total = 5;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('shows accessible controls and emits a valid page when more than five records exist', () => {
    fixture.componentInstance.total = 11;
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('List pages');
    expect(nav.textContent).toContain('Showing 1–5 of 11');
    const next = nav.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
    const pageChange = jasmine.createSpy('pageChange');
    fixture.componentInstance.pageChange.subscribe(pageChange);

    next.click();

    expect(pageChange).toHaveBeenCalledOnceWith(2);
  });
});
