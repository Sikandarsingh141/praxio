import { Component } from '@angular/core';
import { DisputeCenterComponent } from '../../../../shared/components/dispute-center/dispute-center.component';

@Component({
  selector: 'app-customer-disputed-jobs-listing-page',
  standalone: true,
  imports: [DisputeCenterComponent],
  templateUrl: './customer-disputed-jobs-listing.page.html',
  styleUrl: './customer-disputed-jobs-listing.page.scss',
})
export class CustomerDisputedJobsListingPage {}

