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
  requiresPhysicalPickup?: boolean;
  inspectionCompletedBeforeQuotation?: boolean;
  repairJob?: RepairProgressWorkflowJob;
}

export interface RepairProgressWorkflowJob {
  status: string;
  confirmedAt?: string;
  requiresPhysicalPickup?: boolean;
  inspectionCompletedBeforeQuotation?: boolean;
  servicePickup?: {
    scheduledAt?: string;
    collectedAt?: string;
  };
  inspection?: {
    status?: string;
    decidedAt?: string;
  };
  inspectionStartedAt?: string;
  inspectionCompletedAt?: string;
  startedAt?: string;
  repairCompletedAt?: string;
  readyForPickupAt?: string;
  pickedUpAt?: string;
  completedAt?: string;
  history?: Array<{ action: string; at: string }>;
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
  const pickupRequirement =
    input.requiresPhysicalPickup ?? repairJob?.requiresPhysicalPickup;
  const pickupRequired =
    pickupRequirement === true ||
    (pickupRequirement === undefined && pickupStatuses.includes(status ?? ''));
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
    (input.inspectionCompletedBeforeQuotation ??
      repairJob?.inspectionCompletedBeforeQuotation) === true &&
    !pickupRequired;
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
        historyAt('inspection_pending') ??
        acceptedAt,
    },
    {
      key: 'repair',
      label: 'Repair',
      completed: repairCompleted,
      at:
        repairJob?.startedAt ??
        historyAt('repair_started') ??
        historyAt('repair_completed') ??
        repairJob?.repairCompletedAt,
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
