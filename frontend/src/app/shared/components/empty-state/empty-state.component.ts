import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="empty-state" aria-live="polite">
      <div class="empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M12 7h24l3 13v17H9V20l3-13Z" />
          <path d="M9 27h9l3 4h6l3-4h9" />
          <path d="m19 17 3.5 3.5L29 14" />
        </svg>
      </div>
      <div class="empty-copy">
        <p class="empty-eyebrow"><span aria-hidden="true"></span>{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .empty-state {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: clamp(1rem, 3vw, 2.5rem);
      min-height: 14rem;
      margin-top: 1.25rem;
      padding: clamp(1.5rem, 4vw, 2.75rem);
      border: 1px solid #dce9df;
      border-radius: 1rem;
      background:
        radial-gradient(ellipse at 2% 100%, rgb(226 244 230 / 75%), transparent 30%),
        linear-gradient(115deg, #fff 20%, #f8fcf8 100%);
      box-shadow: 0 0.6rem 1.8rem rgb(28 69 43 / 5%);
    }

    .empty-illustration {
      display: grid;
      width: 5.25rem;
      height: 5.25rem;
      place-items: center;
      border: 1px solid #d5e9d9;
      border-radius: 1.35rem;
      background: #eaf6ed;
      box-shadow: inset 0 0 0 0.4rem #f5fbf6;
    }

    .empty-illustration svg {
      width: 2.75rem;
      height: 2.75rem;
      fill: none;
      stroke: #187543;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .empty-copy {
      max-width: 38rem;
    }

    .empty-eyebrow {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 0.5rem;
      color: #287044;
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .empty-eyebrow span {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: #2d9654;
      box-shadow: 0 0 0 0.2rem #e3f3e7;
    }

    .empty-copy h2 {
      margin: 0;
      color: #20352a;
      font-size: clamp(1.2rem, 2vw, 1.55rem);
      font-weight: 750;
      letter-spacing: -0.02em;
    }

    .empty-copy > p:last-child {
      max-width: 34rem;
      margin: 0.55rem 0 0;
      color: #68776d;
      font-size: 0.9rem;
      line-height: 1.65;
    }

    @media (max-width: 500px) {
      .empty-state {
        grid-template-columns: minmax(0, 1fr);
        justify-items: start;
      }
    }
  `,
})
export class EmptyStateComponent {
  @Input() title = 'No jobs found';
  @Input() description = 'Jobs will appear here when they match this status.';

  get eyebrow(): string {
    return this.title.toLocaleLowerCase().includes('matching')
      ? 'No matches found'
      : 'All caught up';
  }
}
