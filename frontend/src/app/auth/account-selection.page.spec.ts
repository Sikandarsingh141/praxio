import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountSelectionPage } from './account-selection.page';

describe('AccountSelectionPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSelectionPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows both account types, benefits, and their registration routes', () => {
    const fixture = TestBed.createComponent(AccountSelectionPage);
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(fixture.nativeElement.textContent).toContain('Create Your Reparo Account');
    expect(fixture.nativeElement.textContent).toContain('Continue as Customer');
    expect(fixture.nativeElement.textContent).toContain('Register as Shop');
    expect(fixture.nativeElement.textContent).toContain('Find nearby repair shops');
    expect(fixture.nativeElement.textContent).toContain('Manage repair jobs');
    expect(fixture.nativeElement.textContent).toContain('Manage technicians');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/auth/register/customer',
      '/auth/register/shop',
      '/auth/login',
    ]);
  });
});
