import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-job-status-badge',
  standalone: true,
  template: `<span class="status-badge" [attr.data-status]="status.toLocaleLowerCase()">{{ label }}</span>`,
  styles: `
    .status-badge {
      display: inline-flex;
      align-items: center;
      min-height: 1.65rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      background: #edf2ef;
      color: #43524a;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.2;
      text-transform: capitalize;
    }
    .status-badge[data-status*='completed'],
    .status-badge[data-status*='approved'],
    .status-badge[data-status*='accepted'] { background: #e7f5eb; color: #176b34; }
    .status-badge[data-status*='pending'],
    .status-badge[data-status*='awaiting'],
    .status-badge[data-status*='inspection'] { background: #fff3dc; color: #87500a; }
    .status-badge[data-status*='disputed'],
    .status-badge[data-status*='rejected'],
    .status-badge[data-status*='declined'],
    .status-badge[data-status*='cancelled'] { background: #fff1ef; color: #a34842; }
    .status-badge[data-status*='progress'],
    .status-badge[data-status*='active'],
    .status-badge[data-status*='confirmed'] { background: #e9f1ff; color: #2457a7; }
  `,
})
export class JobStatusBadgeComponent {
  @Input({ required: true }) status = '';

  get label(): string {
    return this.status.replace(/_/g, ' ').toLocaleLowerCase();
  }
}
