import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-page-header',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
    `,
  ],
  template: `
    <header class="admin-page-header">
      <div class="admin-page-header__main">
        <div class="admin-page-header__leading">
          <ng-content select="[adminPageLeading]" />
        </div>
        <div class="admin-page-header__copy">
          <ng-content select="[adminPageTitle]" />
          <ng-content select="[adminPageDescription]" />
          <div class="admin-page-header__meta">
            <ng-content select="[adminPageMeta]" />
          </div>
        </div>
      </div>
      <div class="admin-page-header__actions">
        <ng-content select="[adminPageActions]" />
      </div>
    </header>
  `,
})
export class AdminPageHeaderComponent {}
