import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Technician, TechnicianActivity } from './technicians.models';
import { TechniciansService } from './technicians.service';
import { TableScrollIndicatorsDirective } from '../../shared/directives/table-scroll-indicators.directive';

type DetailsTab = 'overview' | 'jobs' | 'performance' | 'activity';

@Component({
  selector: 'app-shop-technician-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TableScrollIndicatorsDirective],
  templateUrl: './shop-technician-details.page.html',
  styleUrl: './shop-technician-details.page.scss',
})
export class ShopTechnicianDetailsPage implements OnInit {
  readonly technician = signal<Technician | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<DetailsTab>('overview');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly service: TechniciansService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Technician was not found.');
      this.loading.set(false);
      return;
    }
    this.service.get(id).subscribe({
      next: (technician) => {
        this.technician.set(technician);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Technician details could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: DetailsTab): void {
    this.tab.set(tab);
  }

  toggleActive(): void {
    const technician = this.technician();
    if (!technician) return;
    this.service
      .updateStatus(
        technician.id,
        technician.status === 'active' ? 'inactive' : 'active',
        technician.availability === 'on_leave' ? 'on_leave' : 'available',
      )
      .subscribe({
        next: (updated) => this.technician.set(updated),
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message || 'Technician status could not be updated.'),
      });
  }

  activityLabel(activity: TechnicianActivity): string {
    const label = activity.action.replaceAll('_', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
