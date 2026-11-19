import type { RepairWorkflowJob } from '../models/repair-workflow.models';

export type RepairQuotationProgress = 'none' | 'submitted' | 'accepted';

export interface RepairProgressStep {
  key: string;
  label: string;
  completed: boolean;
  current: boolean;
  at?: string;
}

export interface RepairProgressInput {
  requestCreatedAt: string;
  requestStatus: string;
  quotationStatus: RepairQuotationProgress;
  acceptedAt?: string;
  quotationAt?: string;
  repairJob?: RepairWorkflowJob;
}

export function buildRepairProgressSteps(input: RepairProgressInput): RepairProgressStep[] {
  const { repairJob } = input;
  const status = repairJob?.status;
  const historyAt = (action: string): string | undefined =>
    repairJob?.history?.find((event) => event.action === action)?.at;
  const quotationAccepted = input.quotationStatus === 'accepted';
  const acceptedAt = quotationAccepted
    ? input.acceptedAt ?? repairJob?.confirmedAt
    : undefined;
  const steps: Array<Omit<RepairProgressStep, 'current'>> = [
    {
      key: 'request',
      label: 'Request Submitted',
      completed: true,
      at: input.requestCreatedAt,
    },
    {
      key: 'quotation',
      label:
        input.quotationStatus === 'accepted'
          ? 'Quotation Accepted'
          : input.quotationStatus === 'submitted'
            ? 'Quotation Submitted'
            : 'Quotation',
      completed: quotationAccepted,
      at: acceptedAt ?? input.quotationAt,
    },
  ];

  if (!quotationAccepted) {
    return markCurrentStep(steps);
  }

  const pickupStatuses = [
    'confirmed',
    'pickup_scheduled',
    'pickup_in_progress',
    'item_picked_up',
    'inspection_pending',
    'inspection_in_progress',
    'awaiting_customer_approval',
    'inspection_approved',
    'repair_declined',
    'in_progress',
    'on_hold',
    'repair_completed',
    'ready_for_pickup',
    'picked_up',
    'completed',
  ];
  const pickupRequired =
    repairJob?.requiresPhysicalPickup === true ||
    (repairJob?.requiresPhysicalPickup === undefined &&
      pickupStatuses.includes(status ?? ''));
  if (pickupRequired) {
    const pickupScheduled = Boolean(
      repairJob?.servicePickup?.scheduledAt ||
        historyAt('pickup_scheduled') ||
        [
          'pickup_scheduled',
          'pickup_in_progress',
          'item_picked_up',
          'inspection_pending',
          'inspection_in_progress',
          'awaiting_customer_approval',
          'inspection_approved',
          'repair_declined',
          'in_progress',
          'on_hold',
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
          'completed',
        ].includes(status ?? ''),
    );
    const itemCollected = Boolean(
      repairJob?.servicePickup?.collectedAt ||
        historyAt('item_picked_up') ||
        [
          'item_picked_up',
          'inspection_pending',
          'inspection_in_progress',
          'awaiting_customer_approval',
          'inspection_approved',
          'repair_declined',
          'in_progress',
          'on_hold',
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
          'completed',
        ].includes(status ?? ''),
    );
    steps.push(
      {
        key: 'pickup-scheduled',
        label: 'Pickup Scheduled',
        completed: pickupScheduled,
        at: repairJob?.servicePickup?.scheduledAt ?? historyAt('pickup_scheduled'),
      },
      {
        key: 'item-collected',
        label: 'Item Collected',
        completed: itemCollected,
        at: repairJob?.servicePickup?.collectedAt ?? historyAt('item_picked_up'),
      },
    );
  }

  const inspectionApproved =
    repairJob?.inspection?.status === 'approved' ||
    [
      'inspection_approved',
      'in_progress',
      'on_hold',
      'repair_completed',
      'ready_for_pickup',
      'picked_up',
      'completed',
    ].includes(status ?? '');
  const repairCompleted = [
    'repair_completed',
    'ready_for_pickup',
    'picked_up',
    'completed',
  ].includes(status ?? '');
  const readyForPickup = ['ready_for_pickup', 'picked_up', 'completed'].includes(status ?? '');
  const customerPickedUp = ['picked_up', 'completed'].includes(status ?? '');
  const inspectionCompletedBeforeQuotation =
    repairJob?.inspectionCompletedBeforeQuotation === true && !pickupRequired;
  steps.push(
    {
      key: 'inspection',
      label: inspectionCompletedBeforeQuotation ? 'Inspection Approved' : 'Inspection',
      completed: inspectionCompletedBeforeQuotation || inspectionApproved,
      at:
        repairJob?.inspection?.decidedAt ??
        repairJob?.inspectionCompletedAt ??
        historyAt('inspection_approved') ??
        repairJob?.inspectionStartedAt ??
        historyAt('inspection_started') ??
        acceptedAt,
    },
    {
      key: 'repair',
      label: 'Repair',
      completed: repairCompleted,
      at: repairJob?.startedAt ?? historyAt('repair_started'),
    },
    {
      key: 'ready-for-pickup',
      label: 'Ready for Pickup',
      completed: readyForPickup,
      at: repairJob?.readyForPickupAt ?? historyAt('ready_for_pickup'),
    },
    {
      key: 'customer-pickup',
      label: 'Customer Picked Up',
      completed: customerPickedUp,
      at: repairJob?.pickedUpAt ?? historyAt('picked_up'),
    },
    {
      key: 'completed',
      label: 'Completed',
      completed: status === 'completed' || input.requestStatus === 'completed',
      at: repairJob?.completedAt ?? historyAt('completed'),
    },
  );

  return markCurrentStep(steps);
}

function markCurrentStep(
  steps: Array<Omit<RepairProgressStep, 'current'>>,
): RepairProgressStep[] {
  const currentIndex = steps.findIndex((step) => !step.completed);
  return steps.map((step, index) => ({
    ...step,
    current: index === currentIndex,
  }));
}
