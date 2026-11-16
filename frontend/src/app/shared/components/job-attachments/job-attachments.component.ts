import { Component, Input } from '@angular/core';
import { JobAttachment } from '../../models/job.models';

@Component({
  selector: 'app-job-attachments',
  standalone: true,
  template: `
    @if (items.length) {
      <div class="attachments">
        @for (item of items; track $index) {
          @if (item.mimeType.toLowerCase().startsWith('image/')) {
            @let source = imageSource(item);
            @if (!source || isImageUnavailable(source)) {
              <div class="image-unavailable" role="img" aria-label="No image available">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span>No image available</span>
              </div>
            } @else {
              <a
                class="image-attachment"
                [href]="source"
                target="_blank"
                rel="noopener"
                [attr.aria-label]="'Open attachment ' + (item.name || 'image')"
              >
                <img
                  [src]="source"
                  [alt]="item.name"
                  (error)="markImageUnavailable(source)"
                />
              </a>
            }
          } @else if (item.url) {
            <a class="file-attachment" [href]="item.url" target="_blank" rel="noopener">
              {{ item.name || 'Open attachment' }}
            </a>
          } @else {
            <span class="file-attachment">{{ item.name || 'Attachment' }}</span>
          }
        }
      </div>
      @if (showViewAllAction && imageItems.length > 1) {
        <button type="button" class="attachments-view-all" (click)="viewAllOpen = true">
          View All ({{ imageItems.length }})
        </button>
      }
      @if (viewAllOpen) {
        <div class="attachments-viewer" role="presentation" (click)="viewAllOpen = false">
          <section
            class="attachments-viewer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Uploaded photos"
            (click)="$event.stopPropagation()"
          >
            <header>
              <h2>Uploaded Photos ({{ imageItems.length }})</h2>
              <button type="button" aria-label="Close photo gallery" (click)="viewAllOpen = false">×</button>
            </header>
            <div class="attachments-viewer-grid">
              @for (item of imageItems; track $index) {
                @let source = imageSource(item);
                @if (source && !isImageUnavailable(source)) {
                  <img [src]="source" [alt]="item.name" (error)="markImageUnavailable(source)" />
                } @else {
                  <div class="image-unavailable" role="img" aria-label="No image available">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <span>No image available</span>
                  </div>
                }
              }
            </div>
          </section>
        </div>
      }
    } @else {
      <div class="image-unavailable" role="img" aria-label="No image available">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span>No image available</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .attachments { display: flex; flex-wrap: wrap; gap: .65rem; }
    .image-attachment { display: block; width: 7.5rem; height: 6rem; overflow: hidden; border: 1px solid #e3e9e4; border-radius: .65rem; background: #f5f7f5; }
    img { width: 100%; height: 100%; object-fit: cover; }
    .image-unavailable { display: flex; width: 7.5rem; height: 6rem; flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: center; gap: .3rem; border: 1px dashed #d6e2d8; border-radius: .65rem; background: #f4f8f5; color: #66746b; font-size: .78rem; }
    .image-unavailable svg { width: 2rem; height: 2rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
    .attachments-view-all { margin-top: .65rem; padding: 0; border: 0; background: none; color: #087c3b; cursor: pointer; font: inherit; font-size: .78rem; font-weight: 700; }
    .attachments-viewer { position: fixed; z-index: 1200; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgb(15 30 20 / 65%); }
    .attachments-viewer-panel { width: min(100%, 56rem); max-height: 90vh; overflow: auto; padding: 1rem; border: 1px solid #e1e9e3; border-radius: .9rem; background: #fff; box-shadow: 0 1rem 3rem rgb(15 30 20 / 24%); }
    .attachments-viewer-panel header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .75rem; }
    .attachments-viewer-panel h2 { margin: 0; color: #17212b; font-size: 1rem; }
    .attachments-viewer-panel header button { width: 2rem; height: 2rem; border: 0; border-radius: 50%; background: #f1f5f2; color: #43564a; cursor: pointer; font-size: 1.3rem; }
    .attachments-viewer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: .65rem; }
    .attachments-viewer-grid img,.attachments-viewer-grid .image-unavailable { width: 100%; height: 12rem; }
    .file-attachment { display: inline-flex; align-items: center; min-height: 2.5rem; padding: .5rem .75rem; border: 1px solid #e3e9e4; border-radius: .6rem; color: #087c3b; font-size: .84rem; text-decoration: none; }
  `,
})
export class JobAttachmentsComponent {
  @Input() items: JobAttachment[] = [];
  @Input() showViewAllAction = false;
  viewAllOpen = false;

  private readonly unavailableImages = new Set<string>();

  get imageItems(): JobAttachment[] {
    return this.items.filter((item) => item.mimeType.toLowerCase().startsWith('image/'));
  }

  imageSource(item: JobAttachment): string {
    const data = item.data?.trim();
    if (data) {
      if (
        data.startsWith('data:') ||
        /^https?:\/\//i.test(data) ||
        data.startsWith('/') ||
        data.startsWith('blob:')
      ) {
        return data;
      }
      return `data:${item.mimeType || 'image/jpeg'};base64,${data}`;
    }
    return item.url?.trim() ?? '';
  }

  isImageUnavailable(source: string): boolean {
    return this.unavailableImages.has(source);
  }

  markImageUnavailable(source: string): void {
    this.unavailableImages.add(source);
  }
}
