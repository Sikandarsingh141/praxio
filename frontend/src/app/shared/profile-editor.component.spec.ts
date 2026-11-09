import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { ProfileEditorComponent } from './profile-editor.component';

describe('ProfileEditorComponent', () => {
  const user: UserProfile = {
    id: 'user-id',
    email: 'person@example.com',
    fullName: 'Taylor Example',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const authService = {
    currentUser: () => user,
    updateMyProfile: jasmine.createSpy().and.returnValue(of(user)),
    uploadMyProfileImage: jasmine.createSpy().and.returnValue(of(user)),
  };

  beforeEach(async () => {
    authService.updateMyProfile.calls.reset();
    authService.uploadMyProfileImage.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ProfileEditorComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('saves the edited name through the account profile API', () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#profile-full-name') as HTMLInputElement;
    input.value = 'Taylor Updated';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(authService.updateMyProfile).toHaveBeenCalledWith('Taylor Updated');
    expect(fixture.nativeElement.textContent).toContain('Your name has been updated.');
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
});
