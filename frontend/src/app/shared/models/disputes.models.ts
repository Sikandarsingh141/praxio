export type DisputeCategory =
  | 'same_issue_exists'
  | 'repair_quality'
  | 'device_not_working'
  | 'new_issue_discovered'
  | 'unauthorized_work'
  | 'incorrect_charges'
  | 'overcharge'
  | 'incomplete_repair'
  | 'item_not_returned'
  | 'device_damaged'
  | 'shop_unresponsive'
  | 'payment'
  | 'collection'
  | 'other';

export type DisputeStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'REINSPECTION_IN_PROGRESS'
  | 'AWAITING_CUSTOMER_APPROVAL'
  | 'REPAIR_IN_PROGRESS'
  | 'CUSTOMER_VERIFICATION_PENDING'
  | 'CUSTOMER_CONFIRMED'
  | 'REOPENED'
  | 'CLOSED'
  | 'UNDER_REVIEW'
  | 'AWAITING_CUSTOMER_RESPONSE'
  | 'AWAITING_SHOP_RESPONSE'
  | 'RESOLUTION_PROPOSED'
  | 'RESOLVED';

export type LegacyDisputeStatus =
  | 'UNDER_REVIEW'
  | 'AWAITING_CUSTOMER_RESPONSE'
  | 'AWAITING_SHOP_RESPONSE'
  | 'RESOLUTION_PROPOSED'
  | 'RESOLVED';

export type DisputePriority = 'low' | 'normal' | 'high' | 'urgent';
export type DisputeRole = 'customer' | 'shop' | 'admin';
export type DisputeFileType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export interface DisputeAttachment {
  mimeType: DisputeFileType;
  name: string;
  data?: string;
  fileId?: string;
  size?: number;
}

export interface DisputeMessage {
  authorId: string;
  authorRole: DisputeRole;
  message: string;
  attachments: DisputeAttachment[];
  internal: boolean;
  createdAt: string;
}

export interface DisputeResolution {
  type?: string;
  description?: string;
  amount?: number;
  responsibleParty?: string;
  notes?: string;
  decision?: string;
  decisionExplanation?: string;
  state?: 'draft' | 'proposed' | 'final';
  documents: DisputeAttachment[];
  completionDocuments: DisputeAttachment[];
  proposedAt?: string;
  customerAcceptedAt?: string;
  shopAcceptedAt?: string;
  customerRejectionReason?: string;
  shopRejectionReason?: string;
  refundTransactionId?: string;
  requiredActionCompleted: boolean;
  completionNotes?: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface DisputeReinspection {
  findings: string;
  identifiedProblem: string;
  requiredRepairWork: string;
  partsRequired?: string;
  labourCharges?: number;
  otherCharges?: number;
  estimatedCompletionTime?: string;
  message?: string;
  attachments: DisputeAttachment[];
  submittedAt: string;
}

export interface DisputeAdditionalCharge {
  _id: string;
  reason: string;
  items: Array<{ description: string; amount: number }>;
  total: number;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  requestedAt: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface DisputeProgress {
  notes: string;
  attachments: DisputeAttachment[];
  submittedAt: string;
}

export interface DisputeReworkCompletion {
  workPerformed: string;
  partsReplaced?: string;
  testingResults: string;
  finalNotes?: string;
  tested: boolean;
  attachments: DisputeAttachment[];
  completedAt: string;
}

export interface DisputeCustomerVerification {
  comments?: string;
  attachments: DisputeAttachment[];
  confirmedAt: string;
}

export interface RepairDispute {
  _id: string;
  reference: string;
  repairRequestId: string;
  customerId: string;
  shopId: string;
  category: DisputeCategory;
  subject: string;
  description: string;
  expectedResolution: string;
  amountInDispute?: number;
  attachments: DisputeAttachment[];
  customerComments?: string;
  status: DisputeStatus;
  priority: DisputePriority;
  messages: DisputeMessage[];
  internalNotes?: DisputeMessage[];
  shopResponse?: {
    explanation: string;
    proposedResolution?: string;
    message: string;
    attachments: DisputeAttachment[];
    respondedAt: string;
  };
  statusHistory: Array<{
    from: DisputeStatus | 'NONE';
    to: DisputeStatus;
    actorRole: DisputeRole;
    reason?: string;
    at: string;
  }>;
  resolution: DisputeResolution;
  reinspections: DisputeReinspection[];
  additionalCharges: DisputeAdditionalCharge[];
  reworkProgress: DisputeProgress[];
  reworkCompletions: DisputeReworkCompletion[];
  verificationHistory: DisputeCustomerVerification[];
  disputeClosedAt?: string;
  createdAt: string;
  updatedAt: string;
  parties?: {
    customer: { id: string; name?: string; email?: string } | null;
    shop: { id: string; name?: string; email?: string } | null;
  };
  repair?: {
    id: string;
    appliance: string;
    brand?: string;
    model?: string;
    description: string;
    photos: Array<{ mimeType: string; data: string }>;
    status: string;
    createdAt: string;
    repairJob?: Record<string, unknown>;
    quotation?: {
      amount: number;
      currency: string;
      message: string;
      proposedSolution?: string;
    } | null;
  };
}

export interface DisputeListResult {
  items: RepairDispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: Record<string, number>;
}

export interface DisputeListFilters {
  status?: DisputeStatus | '';
  category?: DisputeCategory | '';
  priority?: DisputePriority | '';
  search?: string;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'priority';
  page?: number;
  limit?: number;
}
