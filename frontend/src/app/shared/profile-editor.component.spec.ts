import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { ProfileEditorComponent } from './profile-editor.component';

describe('ProfileEditorComponent', () => {
  const user: UserProfile = {
    id: 'user-id',
    email: 'person@example.com',
    firstName: 'Taylor',
    lastName: 'Example',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const authService = {
    currentUser: () => user,
    updateMyProfile: jasmine.createSpy().and.returnValue(of(user)),
    uploadMyProfileImage: jasmine.createSpy().and.returnValue(of(user)),
    changeMyPassword: jasmine.createSpy().and.returnValue(of(undefined)),
  };

  beforeEach(async () => {
    authService.updateMyProfile.calls.reset();
    authService.uploadMyProfileImage.calls.reset();
    authService.changeMyPassword.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ProfileEditorComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('saves separate first and last names through the account profile API', () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.detectChanges();

    const firstName = fixture.nativeElement.querySelector(
      '#profile-first-name',
    ) as HTMLInputElement;
    firstName.value = 'Taylor Updated';
    firstName.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(authService.updateMyProfile).toHaveBeenCalledWith('Taylor Updated', 'Example');
    expect(fixture.nativeElement.textContent).toContain('Your name has been updated.');
  });

  it('can hide the separate name form when names are edited with business details', () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.componentRef.setInput('showNameForm', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.name-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.profile-photo-row')).not.toBeNull();
  });

  it('prevents selecting unsupported profile image formats', () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not an image'], 'document.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(authService.uploadMyProfileImage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Choose a JPEG, PNG, or WebP image smaller than 1 MB.',
    );
  });

  it('requires matching new passwords and sends password changes securely', () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.componentRef.setInput('allowPasswordChange', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.currentPassword.set('OldPassword1');
    component.newPassword.set('NewPassword2');
    component.confirmPassword.set('DifferentPassword2');
    component.changePassword(new Event('submit'));
    expect(authService.changeMyPassword).not.toHaveBeenCalled();
    expect(component.passwordError()).toBe('The new passwords do not match.');

    component.confirmPassword.set('NewPassword2');
    component.changePassword(new Event('submit'));
    expect(authService.changeMyPassword).toHaveBeenCalledWith('OldPassword1', 'NewPassword2');
    expect(component.passwordSuccess()).toBe('Your password has been updated.');
    expect(component.currentPassword()).toBe('');
  });
});
