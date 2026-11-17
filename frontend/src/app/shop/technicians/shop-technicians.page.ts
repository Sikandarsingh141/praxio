import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Technician, TechnicianAvailability } from './technicians.models';
import { TechniciansService } from './technicians.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-shop-technicians-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaginationComponent],
  templateUrl: './shop-technicians.page.html',
  styleUrl: './shop-technicians.page.scss',
})
export class ShopTechniciansPage implements OnInit {
  readonly technicians = signal<Technician[]>([]);
  readonly summary = signal({ total: 0, available: 0, busy: 0, onLeave: 0, inactive: 0 });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly skillFilter = signal('');
  readonly sortBy = signal<'name' | 'workload' | 'joiningDate'>('name');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly skillOptions = computed(() => [
    ...new Set(this.technicians().flatMap((technician) => technician.skills)),
  ].sort());
  readonly filteredTechnicians = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.technicians()
      .filter((technician) => {
        const matchesText =
          !query ||
          [
            technician.name,
            technician.employeeId,
            technician.email,
            technician.skills.join(' '),
            technician.specialization,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query);
        const matchesStatus = !this.statusFilter() || technician.availability === this.statusFilter();
        const matchesSkill = !this.skillFilter() || technician.skills.includes(this.skillFilter());
        return matchesText && matchesStatus && matchesSkill;
      })
      .sort((left, right) => {
        if (this.sortBy() === 'workload') return right.workload - left.workload;
        if (this.sortBy() === 'joiningDate') {
          return new Date(left.joiningDate ?? 0).getTime() - new Date(right.joiningDate ?? 0).getTime();
        }
        return left.name.localeCompare(right.name);
      });
  });
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredTechnicians().length / this.pageSize())),
  );
  readonly visibleTechnicians = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredTechnicians().slice(start, start + this.pageSize());
  });

  constructor(private readonly service: TechniciansService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list().subscribe({
      next: (result) => {
        this.technicians.set(result.technicians);
        this.summary.set(result.summary);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Technicians could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setFilter(kind: 'status' | 'skill', value: string): void {
    if (kind === 'status') this.statusFilter.set(value);
    else this.skillFilter.set(value);
    this.page.set(1);
  }

  toggleStatus(technician: Technician): void {
    const status = technician.status === 'active' ? 'inactive' : 'active';
    const availabilityPreference =
      technician.availability === 'on_leave' ? 'on_leave' : 'available';
    this.service.updateStatus(technician.id, status, availabilityPreference).subscribe({
      next: (updated) => this.replace(updated),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Technician status could not be updated.'),
    });
  }

  changeAvailability(technician: Technician, availability: 'available' | 'on_leave'): void {
    this.service.updateStatus(technician.id, technician.status, availability).subscribe({
      next: (updated) => this.replace(updated),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Technician availability could not be updated.'),
    });
  }

  availabilityLabel(value: TechnicianAvailability): string {
    return {
      available: 'Available',
      busy: 'Busy',
      on_leave: 'On Leave',
      inactive: 'Inactive',
    }[value];
  }

  changePage(page: number): void {
    this.page.set(Math.min(this.pageCount(), Math.max(1, page)));
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  private replace(updated: Technician): void {
    this.technicians.update((current) =>
      current.map((technician) => (technician.id === updated.id ? updated : technician)),
    );
    this.loadSummaryFromList();
  }

  private loadSummaryFromList(): void {
    const list = this.technicians();
    this.summary.set({
      total: list.length,
      available: list.filter((technician) => technician.availability === 'available').length,
      busy: list.filter((technician) => technician.availability === 'busy').length,
      onLeave: list.filter((technician) => technician.availability === 'on_leave').length,
      inactive: list.filter((technician) => technician.availability === 'inactive').length,
    });
  }
}
