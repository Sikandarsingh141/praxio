import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    fixture = TestBed.createComponent(PaginationComponent);
  });

  it('shows the requested range and page size control for one-page results', () => {
    fixture.componentInstance.total = 8;
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.textContent).toContain('1–8 of 8');
    const select = nav.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('10');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['5', '10', '25', '100']);
  });

  it('emits next page and the selected page size', () => {
    fixture.componentInstance.total = 377;
    fixture.detectChanges();
    const pageChange = jasmine.createSpy('pageChange');
    const pageSizeChange = jasmine.createSpy('pageSizeChange');
    fixture.componentInstance.pageChange.subscribe(pageChange);
    fixture.componentInstance.pageSizeChange.subscribe(pageSizeChange);
    (fixture.nativeElement.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    expect(pageChange).toHaveBeenCalledOnceWith(2);
    expect(pageSizeChange).toHaveBeenCalledOnceWith(25);
  });

  it('shows ellipses and the last page for large result sets', () => {
    fixture.componentInstance.total = 377;
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.querySelectorAll('.ellipsis').length).toBe(1);
    expect(nav.querySelector('[aria-label="Last page, page 38"]')).toBeTruthy();
  });
});
