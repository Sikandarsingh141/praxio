import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
    service.clear();
  });

  afterEach(() => {
    service.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should display success notification with 5s duration', () => {
    service.success('Success Title', 'Success Description');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].title).toBe('Success Title');
    expect(toasts[0].message).toBe('Success Description');
    expect(toasts[0].duration).toBe(5000);
  });

  it('should display error notification with 8s duration', () => {
    service.error('Error Title', 'Error Description');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].duration).toBe(8000);
  });

  it('should display warning notification with 7s duration', () => {
    service.warning('Warning Title', 'Warning Description');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('warning');
    expect(toasts[0].duration).toBe(7000);
  });

  it('should display info notification with 5s duration', () => {
    service.info('Info Title', 'Info Description');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].duration).toBe(5000);
  });

  it('should prevent duplicate notifications with same type, title and message', () => {
    service.success('Quotation Submitted!', 'The customer has been notified successfully.');
    service.success('Quotation Submitted!', 'The customer has been notified successfully.');
    expect(service.toasts().length).toBe(1);
  });

  it('should allow stacking multiple different notifications', () => {
    service.success('Success 1', 'Message 1');
    service.warning('Warning 1', 'Message 2');
    service.error('Error 1', 'Message 3');
    service.info('Info 1', 'Message 4');
    expect(service.toasts().length).toBe(4);
  });

  it('should pause and resume notification on hover', () => {
    const id = service.info('Test Hover', 'Hover message');
    service.pause(id);
    expect(service.toasts().find((t) => t.id === id)?.paused).toBe(true);

    service.resume(id);
    expect(service.toasts().find((t) => t.id === id)?.paused).toBe(false);
  });

  it('should manually dismiss notification', fakeAsync(() => {
    const id = service.success('To Dismiss', 'Dismiss message');
    expect(service.toasts().length).toBe(1);

    service.dismiss(id);
    expect(service.toasts()[0].closing).toBe(true);

    tick(300);
    expect(service.toasts().length).toBe(0);
  }));
});
