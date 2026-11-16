import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Technician } from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';

type TechnicianAccountView = 'performance' | 'availability' | 'profile';

@Component({
  selector: 'app-shop-technician-account-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shop-technician-account.page.html',
  styleUrl: './shop-technician-account.page.scss',
})
export class ShopTechnicianAccountPage implements OnInit {
  readonly view = signal<TechnicianAccountView>('profile');
  readonly technician = signal<Technician | null>(null);
  readonly loading = signal(true);
  readonly updatingAvailability = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly completionRate = computed(() => {
    const performance = this.technician()?.performance;
    if (!performance || performance.totalJobs === 0) return null;
    return Math.round((performance.completedJobs / performance.totalJobs) * 100);
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly technicians: TechniciansService,
  ) {}

  ngOnInit(): void {
    const view = this.route.snapshot.data['technicianView'];
    if (view === 'performance' || view === 'availability' || view === 'profile') {
      this.view.set(view);
    }
    this.loadProfile();
  }

  updateAvailability(event: Event): void {
    const preference = (event.target as HTMLSelectElement).value;
    if (preference !== 'available' && preference !== 'on_leave') return;
    this.updatingAvailability.set(true);
    this.error.set('');
    this.success.set('');
    this.technicians
      .updateMyAvailability(preference)
      .pipe(finalize(() => this.updatingAvailability.set(false)))
      .subscribe({
        next: (technician) => {
          this.technician.set(technician);
          this.success.set('Your availability was updated.');
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message || 'Your availability could not be updated.'),
      });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.technicians
      .myProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (technician) => this.technician.set(technician),
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message || 'Technician details could not be loaded.'),
      });
  }
}
