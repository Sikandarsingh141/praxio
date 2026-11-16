import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="empty-state" aria-live="polite">
      <span class="empty-icon" aria-hidden="true">✓</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .empty-state { padding: 3rem 1.25rem; border: 1px dashed #cbd8cf; border-radius: .9rem; background: #fff; text-align: center; }
    .empty-icon { display: grid; width: 2.5rem; height: 2.5rem; margin: 0 auto .8rem; place-items: center; border-radius: 50%; background: #e7f5eb; color: #176b34; font-size: 1.2rem; font-weight: 800; }
    h2 { margin: 0; color: #20302b; font-size: 1.1rem; }
    p { max-width: 34rem; margin: .45rem auto 0; color: #647169; line-height: 1.5; }
  `,
})
export class EmptyStateComponent {
  @Input() title = 'No jobs found';
  @Input() description = 'Jobs will appear here when they match this status.';
}
