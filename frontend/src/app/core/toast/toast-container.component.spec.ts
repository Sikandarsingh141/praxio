import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from './toast.service';

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    toastService.clear();
    fixture.detectChanges();
  });

  afterEach(() => {
    toastService.clear();
  });

  it('should render toast card in bottom-right container', () => {
    toastService.success('Quotation Submitted!', 'The customer has been notified successfully.');
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.toast-container');
    expect(container).toBeTruthy();

    const card = fixture.nativeElement.querySelector('.toast-card');
    expect(card).toBeTruthy();
    expect(card.classList.contains('toast-success')).toBe(true);

    const title = fixture.nativeElement.querySelector('.toast-title');
    expect(title.textContent).toContain('Quotation Submitted!');

    const message = fixture.nativeElement.querySelector('.toast-message');
    expect(message.textContent).toContain('The customer has been notified successfully.');

    const icon = fixture.nativeElement.querySelector('.icon-success');
    expect(icon).toBeTruthy();

    const progressBar = fixture.nativeElement.querySelector('.toast-progress-bar');
    expect(progressBar).toBeTruthy();
  });

  it('should trigger manual dismissal when clicking close button', fakeAsync(() => {
    toastService.error('Error Title', 'Error Message');
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.toast-close-btn');
    expect(closeBtn).toBeTruthy();

    closeBtn.click();
    fixture.detectChanges();

    expect(toastService.toasts()[0].closing).toBe(true);
    tick(300);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.toast-card').length).toBe(0);
  }));

  it('should pause on mouseenter and resume on mouseleave', () => {
    toastService.warning('Warning Title', 'Warning Message');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.toast-card');
    card.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(toastService.toasts()[0].paused).toBe(true);

    card.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(toastService.toasts()[0].paused).toBe(false);
  });
});
