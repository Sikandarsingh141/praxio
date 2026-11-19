import { CommonModule, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopRepairRouteComponent } from '../../shop/repair-job-details/components/shop-repair-route.component';
import { AdminMapEntity, AdminRepairJob, AdminService } from '../services/admin.service';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';
import { RepairProgressComponent } from '../../shared/components/repair-progress/repair-progress.component';
import { JobTimelineComponent } from '../../shared/components/job-timeline/job-timeline.component';
import { buildRepairProgressSteps } from '../../shared/utils/repair-progress.util';

type Coordinates = { latitude: number; longitude: number };

@Component({
  selector: 'app-admin-repair-job-details-page',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    RepairProgressComponent,
    JobTimelineComponent,
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
  readonly repairProgressSteps = computed(() => {
    const repair = this.job();
    if (!repair) return [];
    const quotation = repair.quotation;
    return buildRepairProgressSteps({
      requestCreatedAt: repair.createdAt,
      requestStatus: repair.repairJob.status,
      quotationStatus:
        quotation?.status === 'accepted' ? 'accepted' : quotation ? 'submitted' : 'none',
      acceptedAt: repair.repairJob.confirmedAt,
      quotationAt: quotation?.createdAt,
      requiresPhysicalPickup:
        quotation?.requiresPhysicalPickup ?? repair.repairJob.requiresPhysicalPickup,
      inspectionCompletedBeforeQuotation:
        quotation?.inspectionCompletedBeforeQuotation ??
        repair.repairJob.inspectionCompletedBeforeQuotation,
      repairJob: repair.repairJob,
    });
  });
  readonly repairHistory = computed(() =>
    (this.job()?.repairJob.history ?? []).map((event) => ({
      title: event.action
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: event.notes,
      at: event.at,
    })),
  );
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

  customerPhotoSource(value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.customerImageUnavailable() ? source : null;
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
