import { Component, Input } from '@angular/core';
import { JobAttachment } from '../../models/job.models';

@Component({
  selector: 'app-job-attachments',
  standalone: true,
  template: `
    @if (items.length) {
      <div class="attachments">
        @for (item of items; track $index) {
          @if (item.data && item.mimeType.startsWith('image/')) {
            <a
              class="image-attachment"
              [href]="'data:' + item.mimeType + ';base64,' + item.data"
              target="_blank"
              rel="noopener"
              [attr.aria-label]="'Open attachment ' + (item.name || 'image')"
            >
              <img [src]="'data:' + item.mimeType + ';base64,' + item.data" [alt]="item.name" />
            </a>
          } @else if (item.url) {
            <a class="file-attachment" [href]="item.url" target="_blank" rel="noopener">
              {{ item.name || 'Open attachment' }}
            </a>
          } @else {
            <span class="file-attachment">{{ item.name || 'Attachment' }}</span>
          }
        }
      </div>
    } @else {
      <p class="empty-attachments">No files or photos were attached to this job.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .attachments { display: flex; flex-wrap: wrap; gap: .65rem; }
    .image-attachment { display: block; width: 7.5rem; height: 6rem; overflow: hidden; border: 1px solid #e3e9e4; border-radius: .65rem; background: #f5f7f5; }
    img { width: 100%; height: 100%; object-fit: cover; }
    .file-attachment { display: inline-flex; align-items: center; min-height: 2.5rem; padding: .5rem .75rem; border: 1px solid #e3e9e4; border-radius: .6rem; color: #087c3b; font-size: .84rem; text-decoration: none; }
    .empty-attachments { margin: 0; color: #718078; font-size: .85rem; }
  `,
})
export class JobAttachmentsComponent {
  @Input() items: JobAttachment[] = [];
}
