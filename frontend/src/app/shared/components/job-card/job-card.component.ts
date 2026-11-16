import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobListItem } from '../../models/job.models';
import { JobStatusBadgeComponent } from '../job-status-badge/job-status-badge.component';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent],
  template: `
    <article class="job-card">
      @if (job.imageData && job.imageMimeType) {
        <img
          class="job-image"
          [src]="'data:' + job.imageMimeType + ';base64,' + job.imageData"
          alt=""
        />
      } @else {
        <div class="job-image image-placeholder" aria-hidden="true">FIX</div>
      }
      <div class="job-content">
        <div class="job-heading">
          <div>
            <p class="job-reference">Job #{{ job.id.slice(-8).toUpperCase() }}</p>
            <h2>{{ job.title }} <span>{{ job.brand }} {{ job.model }}</span></h2>
          </div>
          <app-job-status-badge [status]="job.status" />
        </div>
        <p class="job-description">{{ job.description }}</p>
        <dl class="job-meta">
          @if (job.customerName) {
            <div><dt>Customer</dt><dd>{{ job.customerName }}</dd></div>
          }
          @if (job.shopName) {
            <div><dt>Shop</dt><dd>{{ job.shopName }}</dd></div>
          }
          <div><dt>Created</dt><dd>{{ job.createdAt | date: 'mediumDate' }}</dd></div>
          @if (job.amount !== undefined && job.amount !== null) {
            <div><dt>Amount</dt><dd>{{ job.amount | currency: job.currency }}</dd></div>
          }
        </dl>
        <a class="open-job" [routerLink]="detailLink">View job details <span aria-hidden="true">→</span></a>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .job-card {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr);
      overflow: hidden;
      border: 1px solid #e3e9e4;
      border-radius: 0.9rem;
      background: #fff;
      box-shadow: 0 2px 10px rgb(20 40 28 / 5%);
    }
    .job-image { width: 7rem; height: 100%; min-height: 9.5rem; object-fit: cover; background: #f0f4f1; }
    .image-placeholder { display: grid; place-items: center; color: #718078; font-weight: 800; letter-spacing: .08em; }
    .job-content { min-width: 0; padding: 1rem 1.15rem; }
    .job-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: .75rem; }
    .job-reference { margin: 0 0 .25rem; color: #647169; font-size: .75rem; font-weight: 650; }
    h2 { margin: 0; color: #17211b; font-size: 1.1rem; }
    h2 span { color: #647169; font-size: .85rem; font-weight: 500; }
    .job-description { display: -webkit-box; overflow: hidden; margin: .55rem 0; color: #536159; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .job-meta { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; margin: .65rem 0; }
    .job-meta div { min-width: 5rem; }
    dt { color: #77827c; font-size: .7rem; }
    dd { margin: .15rem 0 0; color: #2c3a32; font-size: .82rem; font-weight: 650; }
    .open-job { display: inline-flex; gap: .45rem; align-items: center; margin-top: .2rem; color: #087c3b; font-weight: 700; text-decoration: none; }
    .open-job:hover { text-decoration: underline; }
    @media (max-width: 540px) {
      .job-card { grid-template-columns: minmax(0, 1fr); }
      .job-image { width: 100%; height: 8rem; min-height: 8rem; }
      .job-heading { flex-direction: column-reverse; align-items: flex-start; }
    }
  `,
})
export class JobCardComponent {
  @Input({ required: true }) job!: JobListItem;
  @Input({ required: true }) detailLink: string[] = [];
}
