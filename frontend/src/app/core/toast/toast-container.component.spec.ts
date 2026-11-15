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

  it('should render message toast with sender profile photo, online indicator, and metadata', () => {
    toastService.showRealtimeMessage({
      conversationId: 'conv-101',
      senderId: 'user-202',
      senderName: 'Sikandar Customer',
      senderPhoto: 'data:image/jpeg;base64,profilephoto',
      isOnline: true,
      repairItem: 'Nokia Phone',
      requestId: '#88907075',
      content: 'Can you share the updated quotation?',
      destinationUrl: '/shop/messages?conversationId=conv-101',
    });
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.toast-message-card');
    expect(card).toBeTruthy();

    const senderName = fixture.nativeElement.querySelector('.msg-sender-name');
    expect(senderName.textContent).toContain('Sikandar Customer');

    const metaLine = fixture.nativeElement.querySelector('.msg-meta-line');
    expect(metaLine.textContent).toContain('Nokia Phone · Request #88907075');

    const preview = fixture.nativeElement.querySelector('.msg-preview-text');
    expect(preview.textContent).toContain('Can you share the updated quotation?');

    const unreadPill = fixture.nativeElement.querySelector('.msg-unread-pill');
    expect(unreadPill.textContent).toContain('1 new message');

    const avatarImg = fixture.nativeElement.querySelector('.msg-avatar-img');
    expect(avatarImg).toBeTruthy();
    expect(avatarImg.getAttribute('src')).toBe('data:image/jpeg;base64,profilephoto');

    const onlineDot = fixture.nativeElement.querySelector('.msg-online-indicator');
    expect(onlineDot).toBeTruthy();

    const viewBtn = fixture.nativeElement.querySelector('.msg-view-btn');
    expect(viewBtn).toBeTruthy();
    expect(viewBtn.textContent).toContain('View Conversation');
  });

  it('should render fallback initials when sender has no profile photo', () => {
    toastService.showRealtimeMessage({
      conversationId: 'conv-102',
      senderId: 'user-203',
      senderName: 'Sikandar Customer',
      content: 'Hello',
      destinationUrl: '/shop/messages?conversationId=conv-102',
    });
    fixture.detectChanges();

    const fallback = fixture.nativeElement.querySelector('.msg-avatar-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent.trim()).toBe('SC');
  });
});
