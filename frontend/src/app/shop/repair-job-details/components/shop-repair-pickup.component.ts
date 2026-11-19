import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/toast/toast.service';
import { ShopRepairRequest } from '../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';

@Component({
  selector: 'app-shop-repair-pickup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shop-repair-pickup.component.html',
  styleUrl: './shop-repair-pickup.component.scss',
})
export class ShopRepairPickupComponent implements OnChanges {
  @Input({ required: true }) request!: ShopRepairRequest;
  @Output() readonly requestUpdated = new EventEmitter<ShopRepairRequest>();
  @HostBinding('class.customer-detail-block')
  get pickupBlockVisible(): boolean {
    return this.needsPhysicalPickup;
  }

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly pickupDate = signal('');
  readonly pickupTime = signal('');
  readonly pickupNotes = signal('');
  readonly pickupScheduleModalOpen = signal(false);

  constructor(
    private readonly requests: ShopRepairRequestsService,
    private readonly toastService: ToastService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['request']) return;
    this.pickupScheduleModalOpen.set(false);
  }

  get job() {
    return this.request.repairJob;
  }

  get needsPhysicalPickup(): boolean {
    return (
      this.job?.requiresPhysicalPickup !== false &&
      ['confirmed', 'pickup_scheduled', 'pickup_in_progress'].includes(
        this.job?.status ?? '',
      )
    );
  }

  get canSchedulePickup(): boolean {
    return this.needsPhysicalPickup && this.job?.status === 'confirmed';
  }

  get canStartPickup(): boolean {
    return this.needsPhysicalPickup && this.job?.status === 'pickup_scheduled';
  }

  get canConfirmPickup(): boolean {
    return (
      this.needsPhysicalPickup &&
      ['pickup_scheduled', 'pickup_in_progress'].includes(this.job?.status ?? '')
    );
  }

  openPickupScheduleModal(): void {
    if (!this.canSchedulePickup) return;
    this.error.set('');
    this.pickupScheduleModalOpen.set(true);
  }

  closePickupScheduleModal(): void {
    this.pickupScheduleModalOpen.set(false);
    this.error.set('');
  }

  schedulePickup(): void {
    if (this.submitting() || !this.canSchedulePickup) return;
    if (!this.pickupDate() || !this.pickupTime()) {
      this.error.set('Select a pickup date and time.');
      return;
    }
    const scheduledAt = new Date(`${this.pickupDate()}T${this.pickupTime()}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.error.set('Select a valid pickup date and time.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.requests
      .schedulePickup(this.request._id, {
        scheduledAt: scheduledAt.toISOString(),
        notes: this.pickupNotes().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.pickupScheduleModalOpen.set(false);
          this.reloadRequest('Pickup scheduled.');
        },
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Pickup could not be scheduled.'),
      });
  }

  startPickup(): void {
    if (this.submitting() || !this.canStartPickup) return;
    this.submitting.set(true);
    this.error.set('');
    this.requests
      .startPickup(this.request._id, this.pickupNotes().trim() || undefined)
      .subscribe({
        next: () => this.reloadRequest('Pickup marked as underway.'),
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Pickup could not be started.'),
      });
  }

  confirmPickup(): void {
    if (this.submitting() || !this.canConfirmPickup) return;
    this.submitting.set(true);
    this.error.set('');
    this.requests
      .confirmPickup(this.request._id, {
        notes: this.pickupNotes().trim() || undefined,
      })
      .subscribe({
        next: () =>
          this.reloadRequest('Collection confirmed. Inspection is now pending.'),
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Collection could not be confirmed.'),
      });
  }

  private reloadRequest(message: string): void {
    this.requests.get(this.request._id).subscribe({
      next: (request) => {
        this.requestUpdated.emit(request);
        this.toastService.success('Repair Workflow', message);
        this.submitting.set(false);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'Updated repair details could not be loaded.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    const msg = error.error?.message || fallback;
    this.error.set(msg);
    this.toastService.error('Workflow Error', msg);
    this.submitting.set(false);
  }
}
