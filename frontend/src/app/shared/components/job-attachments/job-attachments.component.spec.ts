import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobAttachmentsComponent } from './job-attachments.component';

describe('JobAttachmentsComponent', () => {
  let fixture: ComponentFixture<JobAttachmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobAttachmentsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(JobAttachmentsComponent);
  });

  it('opens a gallery with all images when View All is selected', () => {
    fixture.componentRef.setInput('items', [
      { name: 'first.jpg', mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,ZmFrZQ==' },
      { name: 'second.jpg', mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,ZmFrZQ==' },
    ]);
    fixture.componentRef.setInput('showViewAllAction', true);
    fixture.detectChanges();

    const viewAllButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.attachments-view-all');
    expect(viewAllButton.textContent).toContain('View All (2)');

    viewAllButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.attachments-viewer-grid img').length).toBe(2);
  });

  it('does not show View All for a single image', () => {
    fixture.componentRef.setInput('items', [
      { name: 'only.jpg', mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,ZmFrZQ==' },
    ]);
    fixture.componentRef.setInput('showViewAllAction', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.attachments-view-all')).toBeNull();
  });
});
