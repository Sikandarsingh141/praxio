import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { JobTimelineEntry } from '../../models/job.models';

@Component({
  selector: 'app-job-timeline',
  standalone: true,
  imports: [DatePipe, TitleCasePipe],
  template: `
    @if (items.length) {
      <ol class="timeline">
        @for (item of items; track $index) {
          <li>
            <span class="timeline-dot" aria-hidden="true"></span>
            <div>
              <h3>{{ item.title }}</h3>
              @if (item.description) { <p>{{ item.description }}</p> }
              @if (item.actorName || item.actorRole) {
                <p>
                  By {{ item.actorName || (item.actorRole | titlecase) }}
                  @if (item.actorName && item.actorRole) {
                    · {{ item.actorRole | titlecase }}
                  }
                </p>
              }
              @if ((item.attachmentCount ?? 0) > 0) {
                <p>
                  {{ item.attachmentCount }}
                  {{ item.attachmentCount === 1 ? 'attachment' : 'attachments' }}
                </p>
              }
              <time [attr.datetime]="item.at">{{ item.at | date: 'medium' }}</time>
            </div>
          </li>
        }
      </ol>
    } @else {
      <p class="empty-timeline">No repair history has been recorded yet.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .timeline { margin: 0; padding: 0; list-style: none; }
    li { position: relative; display: grid; grid-template-columns: 1rem minmax(0, 1fr); gap: .75rem; padding: 0 0 1.25rem; }
    li:not(:last-child)::before { position: absolute; top: .7rem; bottom: -.2rem; left: .34rem; width: 2px; background: #dce8df; content: ''; }
    .timeline-dot { z-index: 1; width: .75rem; height: .75rem; margin-top: .2rem; border: 2px solid #087c3b; border-radius: 50%; background: #fff; }
    h3 { margin: 0; color: #20302b; font-size: .9rem; }
    p { margin: .2rem 0; color: #536159; font-size: .85rem; }
    time, .empty-timeline { color: #718078; font-size: .78rem; }
  `,
})
export class JobTimelineComponent {
  @Input() items: JobTimelineEntry[] = [];
}
