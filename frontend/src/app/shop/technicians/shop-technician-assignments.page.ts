import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TechnicianAssignment } from './technicians.models';
import { TechniciansService } from './technicians.service';

@Component({
  selector: 'app-shop-technician-assignments-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="assignments-page">
      <header class="page-heading">
        <div><p class="eyebrow">WORK MANAGEMENT</p><h1>Technician Assignments</h1><p>Active repair jobs and the technician responsible for each.</p></div>
        <a routerLink="/shop/repair-requests" class="secondary-button">View repair requests</a>
      </header>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <section class="assignment-list-card">
        <label class="search"><span>⌕</span><input type="search" placeholder="Search request, technician, or customer" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
        @if (loading()) { <p class="state" role="status">Loading assignments…</p> }
        @else if (filtered().length) {
          <div class="table-wrap"><table><thead><tr><th>Repair Request</th><th>Customer</th><th>Technician</th><th>Repair Status</th><th>Assigned On</th><th></th></tr></thead><tbody>
            @for (assignment of filtered(); track assignment.requestId) {
              <tr><td><strong>{{ assignment.appliance }}</strong><small>{{ assignment.requestId.slice(-8).toUpperCase() }} · {{ assignment.brand }} {{ assignment.model }}</small></td><td>{{ assignment.customer }}</td><td>@if (assignment.technician; as tech) { <a class="tech-link" [routerLink]="['/shop/technicians', tech.id]" [attr.aria-label]="'View ' + tech.name + ' profile'"><strong class="tech-name">{{ tech.name }}</strong></a> } @else { <strong class="tech-name">Unknown technician</strong> }<small>{{ assignment.technician?.availability | titlecase }} · {{ assignment.technician?.workload }} active jobs</small></td><td><span class="status">{{ assignment.repairStatus.replace('_', ' ') | titlecase }}</span></td><td>{{ assignment.assignment.assignedAt | date: 'mediumDate' }}</td><td><a [routerLink]="['/shop/repair-requests', assignment.requestId]">Manage</a></td></tr>
            }
          </tbody></table></div>
        } @else { <div class="state"><strong>No active assignments</strong><p>Assign a repair to yourself or a technician from its request details.</p></div> }
      </section>
    </section>
  `,
  styles: `
    :host { display:block;color:#17271d }
    .assignments-page { display:grid;gap:1rem }
    .page-heading { display:flex;align-items:center;justify-content:space-between;gap:1rem }
    .page-heading h1 { margin:0;font-size:1.55rem }
    .page-heading p:not(.eyebrow) { margin:.35rem 0 0;color:#68766d;font-size:.82rem }
    .eyebrow { margin:0 0 .25rem;color:#087c3b;font-size:.65rem;font-weight:800;letter-spacing:.12em }
    .assignment-list-card { overflow:hidden;border:1px solid #e2e8e3;border-radius:.8rem;background:#fff;box-shadow:0 3px 10px rgb(20 40 28 / 5%) }
    .search { display:flex;align-items:center;gap:.45rem;margin:.8rem;padding:0 .6rem;border:1px solid #dfe6e1;border-radius:.5rem;color:#68766d }
    .search input { width:100%;height:2.4rem;border:0;outline:0;font:inherit;font-size:.75rem }
    .table-wrap { overflow:auto }
    table { width:100%;border-collapse:collapse;text-align:left }
    th { padding:.7rem;background:#f7faf7;color:#617067;font-size:.65rem;white-space:nowrap }
    td { padding:.7rem;border-top:1px solid #edf1ed;color:#34443a;font-size:.7rem;white-space:nowrap }
    td:first-child { display:grid;gap:.2rem }
    td small { display:block;margin-top:.18rem;color:#718078;font-size:.63rem }
    td a { color:#087c3b;font-weight:700;text-decoration:none }
    .status { padding:.25rem .45rem;border-radius:99px;background:#eef4ef;font-size:.63rem }
    .tech-name { font-weight:700 }
    .tech-link { display:inline-block;color:inherit;text-decoration:none;cursor:pointer }
    .tech-link:hover .tech-name { color:#087c3b;text-decoration:underline }
    .state { display:grid;min-height:12rem;align-content:center;justify-items:center;gap:.4rem;padding:1rem;color:#718078;font-size:.75rem;text-align:center }
    .state p { margin:0 }
    .state strong { color:#34443a }
    .error { padding:.7rem;border:1px solid #f0ceca;border-radius:.5rem;background:#fff5f4;color:#9d3e37;font-size:.78rem }
    .secondary-button { display:inline-flex;min-height:2.35rem;align-items:center;padding:.5rem .75rem;border:1px solid #cfe0d2;border-radius:.5rem;background:#fff;color:#087c3b;font-size:.73rem;font-weight:700;text-decoration:none;white-space:nowrap }
    @media(max-width:600px) { .page-heading { align-items:flex-start;flex-direction:column } }
  `,
})
export class ShopTechnicianAssignmentsPage implements OnInit {
  readonly assignments = signal<TechnicianAssignment[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');

  constructor(private readonly service: TechniciansService) {}

  readonly filtered = () => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.assignments().filter((assignment) =>
      [
        assignment.requestId,
        assignment.appliance,
        assignment.brand,
        assignment.model,
        assignment.customer,
        assignment.technician?.name ?? '',
        assignment.technician?.employeeId ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  };

  ngOnInit(): void {
    this.service.assignments().subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Technician assignments could not be loaded.');
        this.loading.set(false);
      },
    });
  }
}
