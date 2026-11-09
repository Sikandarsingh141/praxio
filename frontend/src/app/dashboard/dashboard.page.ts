import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerPortalService } from '../customer/customer-portal.service';
import {
  customerRepairRequestStatusLabel,
  CustomerRepairRequest,
} from '../customer/customer-portal.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  readonly services = [
    { name: 'Air conditioning', service: 'AC Repair', short: 'AC', tint: 'sage' },
    { name: 'Refrigerator', service: 'Refrigerator Repair', short: 'RF', tint: 'peach' },
    { name: 'Washing machine', service: 'Washing Machine Repair', short: 'WM', tint: 'blue' },
    { name: 'Television', service: 'TV Repair', short: 'TV', tint: 'lavender' },
    { name: 'Mobile phone', service: 'Mobile Repair', short: 'PH', tint: 'rose' },
    { name: 'Laptop', service: 'Laptop Repair', short: 'PC', tint: 'sand' },
    { name: 'Fan', service: 'Fan Repair', short: 'FN', tint: 'blue' },
    { name: 'Cooler', service: 'Cooler Repair', short: 'CL', tint: 'sage' },
  ];

  readonly loadingStats = signal(true);
  readonly statsError = signal('');
  readonly recentRequests = signal<CustomerRepairRequest[]>([]);
  readonly requestStats = signal([
    {
      label: 'Total requests',
      value: 0,
      icon: 'requests',
      tone: 'total',
      note: "All repair requests you've created",
    },
    {
      label: 'Open requests',
      value: 0,
      icon: 'open',
      tone: 'open',
      note: 'Requests awaiting shop action',
    },
    {
      label: 'Active repairs',
      value: 0,
      icon: 'active',
      tone: 'active',
      note: 'Repairs currently in progress',
    },
    {
      label: 'Completed',
      value: 0,
      icon: 'completed',
      tone: 'completed',
      note: 'Successfully completed repairs',
    },
  ]);

  constructor(private readonly customerPortal: CustomerPortalService) {}

  ngOnInit(): void {
    this.customerPortal.getRepairRequests().subscribe({
      next: (requests) => {
        this.setRequestStats(requests);
        this.recentRequests.set(requests.slice(0, 3));
        this.loadingStats.set(false);
      },
      error: () => {
        this.statsError.set('Repair activity could not be loaded.');
        this.loadingStats.set(false);
      },
    });
  }

  requestStatusLabel(request: CustomerRepairRequest): string {
    return customerRepairRequestStatusLabel(request);
  }

  private setRequestStats(requests: CustomerRepairRequest[]): void {
    this.requestStats.set([
      {
        label: 'Total requests',
        value: requests.length,
        icon: 'requests',
        tone: 'total',
        note: "All repair requests you've created",
      },
      {
        label: 'Open requests',
        value: requests.filter((request) => request.status === 'open' && !request.repairJob).length,
        icon: 'open',
        tone: 'open',
        note: 'Requests awaiting shop action',
      },
      {
        label: 'Active repairs',
        value: requests.filter(
          (request) =>
            !!request.repairJob &&
            !['completed', 'repair_declined'].includes(request.repairJob.status),
        ).length,
        icon: 'active',
        tone: 'active',
        note: 'Repairs currently in progress',
      },
      {
        label: 'Completed',
        value: requests.filter(
          (request) => request.status === 'completed' || request.repairJob?.status === 'completed',
        ).length,
        icon: 'completed',
        tone: 'completed',
        note: 'Successfully completed repairs',
      },
    ]);
  }
}
