import { CommonModule, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopRepairRouteComponent } from '../../shop/repair-job-details/components/shop-repair-route.component';
import { AdminMapEntity, AdminRepairJob, AdminService } from '../services/admin.service';

type Coordinates = { latitude: number; longitude: number };

@Component({
  selector: 'app-admin-repair-job-details-page',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ShopRepairRouteComponent,
    TitleCasePipe,
  ],
  templateUrl: './admin-repair-job-details.page.html',
  styleUrl: './admin-repair-job-details.page.scss',
})
export class AdminRepairJobDetailsPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  readonly job = signal<AdminRepairJob | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly mapLocations = signal<AdminMapEntity | null>(null);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly heroImageUnavailable = signal(false);
  readonly customerImageUnavailable = signal(false);
  readonly progressSteps = [
    'Request Submitted',
    'Inspection Pending',
    'Quotation',
    'Repair & Complete',
  ];
  readonly adminDirectionsLoader = (requestId: string) =>
    this.adminService.getMapRoute(requestId);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Repair job could not be found.');
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  shopLocation(job: AdminRepairJob): string {
    return [
      job.shop?.address,
      job.shop?.city,
      job.shop?.state,
      job.shop?.postalCode,
    ]
      .filter((part): part is string => Boolean(part))
      .join(', ');
  }

  customerName(job: AdminRepairJob): string {
    return (
      job.customer.displayName ||
      [job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') ||
      'Customer'
    );
  }

  customerInitials(job: AdminRepairJob): string {
    const name = this.customerName(job);
    if (name === 'Customer') return job.customer.email?.slice(0, 1).toUpperCase() || 'C';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  customerPhone(job: AdminRepairJob): string {
    return (
      [job.customer.countryCode, job.customer.mobileNumber].filter(Boolean).join(' ') ||
      'Not provided'
    );
  }

  shopPhone(job: AdminRepairJob): string {
    return [job.shop?.countryCode, job.shop?.mobileNumber].filter(Boolean).join(' ') || 'Not provided';
  }

  customerLocation(): string {
    const location = this.customerCoordinates();
    return this.isValidCoordinates(location)
      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
      : 'Not provided';
  }

  photoSource(photo: { mimeType: string; data: string }): string {
    const data = photo.data.trim();
    if (
      data.startsWith('data:') ||
      /^https?:\/\//i.test(data) ||
      data.startsWith('/') ||
      data.startsWith('blob:')
    ) {
      return data;
    }
    return `data:${photo.mimeType || 'image/jpeg'};base64,${data}`;
  }

  statusLabel(job: AdminRepairJob): string {
    return job.repairJob.status
      .replace(/_/g, ' ')
      .replace(/^\w/, (letter) => letter.toUpperCase());
  }

  isRepairComplete(job: AdminRepairJob): boolean {
    return job.repairJob.status === 'completed';
  }

  currentProgressStep(job: AdminRepairJob): number {
    const status = job.repairJob.status;
    if (
      status === 'in_progress' ||
      status === 'on_hold' ||
      status === 'repair_completed' ||
      status === 'ready_for_pickup' ||
      status === 'picked_up' ||
      status === 'completed'
    ) {
      return 4;
    }
    if (
      status === 'awaiting_customer_approval' ||
      status === 'inspection_approved' ||
      status === 'repair_declined' ||
      !!job.quotation
    ) {
      return 3;
    }
    return 2;
  }

  progressDate(job: AdminRepairJob, index: number): string | undefined {
    const historyDate = (action: string): string | undefined =>
      job.repairJob.history?.find((event) => event.action === action)?.at;
    switch (index) {
      case 0:
        return job.createdAt;
      case 1:
        return historyDate('inspection_pending') ?? job.repairJob.confirmedAt;
      case 2:
        return job.quotation?.createdAt ?? job.repairJob.inspection?.submittedAt;
      case 3:
        return (
          historyDate('repair_completed') ??
          job.repairJob.repairCompletedAt ??
          job.repairJob.readyForPickupAt ??
          job.repairJob.completedAt
        );
      default:
        return undefined;
    }
  }

  customerCoordinates(): Coordinates | null {
    const location = this.mapLocations()?.location;
    return this.isValidCoordinates(location) ? location : null;
  }

  shopCoordinates(): Coordinates | null {
    const location = this.mapLocations()?.shopLocation;
    return this.isValidCoordinates(location) ? location : null;
  }

  hasRouteCoordinates(): boolean {
    return !!this.customerCoordinates() && !!this.shopCoordinates();
  }

  private isValidCoordinates(
    location: Coordinates | null | undefined,
  ): location is Coordinates {
    return (
      !!location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  documentCount(job: AdminRepairJob): number {
    return (job.photos?.length ?? 0) + (job.repairJob.inspection?.images?.length ?? 0);
  }

  documents(job: AdminRepairJob): Array<{ mimeType: string; data: string; label: string }> {
    return [
      ...(job.photos ?? []).map((document, index) => ({
        ...document,
        label: `Repair request photo ${index + 1}`,
      })),
      ...(job.repairJob.inspection?.images ?? []).map((document, index) => ({
        ...document,
        label: `Inspection photo ${index + 1}`,
      })),
    ];
  }

  notes(job: AdminRepairJob): Array<{ label: string; text: string; at?: string }> {
    const notes: Array<{ label: string; text: string; at?: string }> = [];
    [job.quotation?.additionalNotes]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) =>
      notes.push({ label: 'Accepted quotation', text, at: job.quotation?.createdAt }),
      );
    const inspection = job.repairJob.inspection;
    [inspection?.message, inspection?.decisionReason]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) =>
        notes.push({ label: 'Inspection', text, at: inspection?.submittedAt }),
      );
    [job.repairJob.finalNotes, job.repairJob.pickupMessage]
      .filter((note): note is string => Boolean(note?.trim()))
      .forEach((text) => notes.push({ label: 'Repair update', text }));
    return notes;
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.loadMapLocations(id);
    this.adminService.getRepairJobDetails(id).subscribe({
      next: (job) => {
        this.job.set(job);
        if (!job) this.error.set('Repair job could not be found.');
        this.heroImageUnavailable.set(false);
        this.customerImageUnavailable.set(false);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair job details could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  private loadMapLocations(id: string): void {
    this.mapLoading.set(true);
    this.mapError.set('');
    this.mapLocations.set(null);
    this.adminService.getMapRequest(id).subscribe({
      next: (locations) => {
        this.mapLocations.set(locations);
        this.mapLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.mapError.set(
          error.error?.message || 'Repair location details could not be loaded.',
        );
        this.mapLoading.set(false);
      },
    });
  }
}
