import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();
  });

  it('displays the listing title and description with the caught-up label', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No new requests');
    fixture.componentRef.setInput(
      'description',
      'New repair requests will appear here.',
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('All caught up');
    expect(fixture.nativeElement.textContent).toContain('No new requests');
    expect(fixture.nativeElement.textContent).toContain(
      'New repair requests will appear here.',
    );
  });

  it('uses a matching-results label when a listing search has no results', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No matching repairs');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No matches found');
  });
});
