export interface RepairEstimatePart {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface RepairWorkflowPhoto {
  mimeType: string;
  data: string;
}

export interface RepairInspectionReport {
  status: 'in_progress' | 'draft' | 'awaiting_approval' | 'approved' | 'declined';
  identifiedProblem?: string;
  findings?: string;
  requiredRepairWork?: string;
  parts: RepairEstimatePart[];
  partsTotal: number;
  labourCharge: number;
  inspectionCharges: number;
  otherCharges: number;
  estimatedTotal: number;
  estimatedTimeValue?: number;
  estimatedTimeUnit?: 'hours' | 'days';
  warranty?: string;
  images: RepairWorkflowPhoto[];
  message?: string;
  decisionReason?: string;
  submittedAt?: string;
  decidedAt?: string;
}

export interface AdditionalChargeRequest {
  _id: string;
  status: 'draft' | 'pending' | 'accepted' | 'rejected';
  issue?: string;
  reason?: string;
  repairDescription?: string;
  parts: RepairEstimatePart[];
  partsTotal: number;
  labourCharge: number;
  otherCharges: number;
  amount: number;
  blocksRepair: boolean;
  estimatedTimeValue?: number;
  estimatedTimeUnit?: 'hours' | 'days';
  images: RepairWorkflowPhoto[];
  message?: string;
  decisionReason?: string;
  requestedAt: string;
  decidedAt?: string;
}

export interface RepairWorkflowJob {
  status:
    | 'confirmed'
    | 'inspection_pending'
    | 'inspection_in_progress'
    | 'awaiting_customer_approval'
    | 'inspection_approved'
    | 'repair_declined'
    | 'in_progress'
    | 'on_hold'
    | 'repair_completed'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'completed'
    | 'disputed';
  confirmedAt?: string;
  startedAt?: string;
  repairCompletedAt?: string;
  completionDescription?: string;
  workPerformed?: string;
  partsReplaced?: string;
  finalNotes?: string;
  pickupInstructions?: string;
  pickupMessage?: string;
  readyForPickupAt?: string;
  pickedUpAt?: string;
  disputeDescription?: string;
  completedAt?: string;
  approvedRepairAmount?: number;
  approvedAdditionalCharges?: number;
  inspection?: RepairInspectionReport;
  additionalChargeRequests?: AdditionalChargeRequest[];
  customerVerification?: {
    received: boolean;
    inspected: boolean;
    satisfaction?: string;
    comments?: string;
    confirmedAt: string;
  };
  history?: Array<{ action: string; notes?: string; at: string }>;
}

export interface RepairEstimatePartInput {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface RepairWorkflowImageInput extends RepairWorkflowPhoto {}

export interface InspectionReportInput {
  action: 'draft' | 'submit';
  identifiedProblem?: string;
  findings?: string;
  requiredRepairWork?: string;
  parts?: RepairEstimatePartInput[];
  labourCharge?: number;
  inspectionCharges?: number;
  otherCharges?: number;
  estimatedTimeValue?: number;
  estimatedTimeUnit?: 'hours' | 'days';
  warranty?: string;
  images?: RepairWorkflowImageInput[];
  message?: string;
}

export interface AdditionalChargeRequestInput {
  action: 'draft' | 'submit';
  draftId?: string;
  issue?: string;
  reason?: string;
  repairDescription?: string;
  parts?: RepairEstimatePartInput[];
  labourCharge?: number;
  otherCharges?: number;
  blocksRepair?: boolean;
  estimatedTimeValue?: number;
  estimatedTimeUnit?: 'hours' | 'days';
  images?: RepairWorkflowImageInput[];
  message?: string;
}
