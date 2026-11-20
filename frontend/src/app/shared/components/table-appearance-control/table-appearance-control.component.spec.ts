import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { UserProfile } from '../../../core/auth/auth.models';
import { TableAppearanceControlComponent } from './table-appearance-control.component';

describe('TableAppearanceControlComponent', () => {
  let fixture: ComponentFixture<TableAppearanceControlComponent>;
  let user: UserProfile;
  let auth: {
    currentUser: WritableSignal<UserProfile | null>;
    updateMyTableAppearance: jasmine.Spy;
  };

  beforeEach(async () => {
    user = {
      id: 'user-id',
      email: 'person@example.com',
      createdAt: new Date().toISOString(),
      tableAppearance: 'curved',
    };
    auth = {
      currentUser: signal(user),
      updateMyTableAppearance: jasmine
        .createSpy()
        .and.callFake((tableAppearance: 'curved' | 'normal') => {
          user = { ...user, tableAppearance };
          auth.currentUser.set(user);
          return of(user);
        }),
    };
    await TestBed.configureTestingModule({
      imports: [TableAppearanceControlComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('saves and reflects the selected table appearance', () => {
    fixture = TestBed.createComponent(TableAppearanceControlComponent);
    fixture.detectChanges();

    const normalButton = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    normalButton.click();
    fixture.detectChanges();

    expect(auth.updateMyTableAppearance).toHaveBeenCalledWith('normal');
    expect(normalButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(
      'Your table preference was saved.',
    );
  });
});
