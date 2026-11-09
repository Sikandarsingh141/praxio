import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ShopImageEditorComponent } from './shop-image-editor.component';

describe('ShopImageEditorComponent', () => {
  const authService = {
    uploadMyShopImage: jasmine.createSpy().and.returnValue(
      of({ shopName: 'Example Repairs', shopImageData: 'data:image/png;base64,abc' }),
    ),
  };

  beforeEach(async () => {
    authService.uploadMyShopImage.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ShopImageEditorComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('uploads a shop image and shows the updated preview', () => {
    const fixture = TestBed.createComponent(ShopImageEditorComponent);
    fixture.componentRef.setInput('shopName', 'Example Repairs');
    fixture.detectChanges();
    const updated = jasmine.createSpy('imageUpdated');
    fixture.componentInstance.imageUpdated.subscribe(updated);
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const image = new File([new Uint8Array([1, 2, 3])], 'shop.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [image] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(authService.uploadMyShopImage).toHaveBeenCalledWith(image);
    expect(updated).toHaveBeenCalledWith('data:image/png;base64,abc');
    expect(fixture.nativeElement.querySelector('.shop-image')?.src).toContain(
      'data:image/png;base64,abc',
    );
    expect(fixture.nativeElement.textContent).toContain('Your shop image has been updated.');
  });

  it('rejects unsupported image formats before upload', () => {
    const fixture = TestBed.createComponent(ShopImageEditorComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not an image'], 'document.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(authService.uploadMyShopImage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Choose a JPEG, PNG, or WebP image smaller than 1 MB.',
    );
  });
});
