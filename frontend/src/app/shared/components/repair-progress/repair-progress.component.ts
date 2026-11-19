import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RepairProgressStep } from '../../utils/repair-progress.util';

@Component({
  selector: 'app-repair-progress',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (steps.length) {
      <ol class="request-progress" aria-label="Repair request progress">
        @for (step of steps; track step.key; let index = $index) {
          <li
            [class.completed]="step.completed"
            [class.current]="step.current"
            [attr.aria-current]="step.current ? 'step' : null"
          >
            <span class="progress-marker" aria-hidden="true">
              @if (step.completed) {
                <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
              } @else {
                {{ index + 1 }}
              }
            </span>
            <strong>{{ step.label }}</strong>
            @if (step.at) {
              <time [attr.datetime]="step.at">{{ step.at | date: 'MMM d, y, h:mm a' }}</time>
            }
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .request-progress {
      position: relative;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(6.6rem, 1fr);
      gap: 0;
      min-width: 0;
      margin: 1rem 0 .85rem;
      padding: 0 0 .35rem;
      overflow-x: auto;
      list-style: none;
      scrollbar-width: thin;
      scroll-snap-type: x proximity;
    }
    li {
      position: relative;
      z-index: 0;
      display: grid;
      min-width: 0;
      justify-items: center;
      align-content: start;
      gap: .3rem;
      color: #728078;
      text-align: center;
      scroll-snap-align: start;
    }
    li:not(:last-child)::after {
      position: absolute;
      z-index: -1;
      top: .72rem;
      left: 50%;
      width: 100%;
      height: 2px;
      background: #dce5de;
      content: '';
    }
    li.completed::after { background: #16842e; }
    .progress-marker {
      position: relative;
      z-index: 1;
      display: grid;
      width: 1.45rem;
      height: 1.45rem;
      place-items: center;
      border: 1px solid #bac8bd;
      border-radius: 50%;
      background: #fff;
      color: #6b796f;
      font-size: .65rem;
      font-weight: 750;
    }
    .progress-marker svg {
      width: .9rem;
      height: .9rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
    }
    li.completed .progress-marker,
    li.current .progress-marker {
      border-color: #087c3b;
      background: #087c3b;
      color: #fff;
    }
    strong {
      color: #27342b;
      font-size: .62rem;
      font-weight: 650;
      white-space: nowrap;
    }
    li.current strong {
      padding: .2rem .35rem;
      border-radius: 999px;
      background: #e6f5e9;
      color: #176b34;
    }
    time {
      color: #87938a;
      font-size: .52rem;
      white-space: nowrap;
    }
    @media (max-width: 600px) {
      .request-progress { grid-auto-columns: minmax(5.8rem, 1fr); }
      strong { font-size: .58rem; }
      time { font-size: .49rem; }
    }
  `,
})
export class RepairProgressComponent {
  @Input() steps: RepairProgressStep[] = [];
}
