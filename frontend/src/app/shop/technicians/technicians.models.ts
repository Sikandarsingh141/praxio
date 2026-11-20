import {
  AdditionalChargeRequest,
  RepairEstimatePart,
  RepairEstimatePartInput,
  RepairInspectionReport,
  InspectionReportInput,
  RepairWorkflowJob,
} from '../../shared/models/repair-workflow.models';

export type {
  AdditionalChargeRequest,
  RepairEstimatePart,
  RepairEstimatePartInput,
  RepairInspectionReport,
  InspectionReportInput,
  RepairWorkflowJob,
};

export type TechnicianAvailability = 'available' | 'busy' | 'on_leave' | 'inactive';
export type TechnicianStatus = 'active' | 'inactive';
export type TechnicianEmploymentType = 'full_time' | 'part_time' | 'contract';

export interface Technician {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  mobileNumber: string;
  profileImageData: string | null;
  employeeId: string;
  skills: string[];
  specialization: string;
  experienceYears: number;
  employmentType: TechnicianEmploymentType;
  joiningDate: string | null;
  status: TechnicianStatus;
  availability: TechnicianAvailability;
  availabilityPreference?: 'available' | 'on_leave';
  workload: number;
  accountCreatedAt: string | null;
  contact?: { phone: string };
  jobs?: TechnicianJob[];
  performance?: {
    totalJobs: number;
    completedJobs: number;
    inProgressJobs: number;
    reassignedJobs: number;
    averageCompletionTimeHours: number | null;
  };
  history?: TechnicianActivity[];
  profileActivity?: TechnicianActivity[];
}

export interface TechnicianSummary {
  total: number;
  available: number;
  busy: number;
  onLeave: number;
  inactive: number;
}

export interface TechnicianJob {
  id: string;
  appliance: string;
  brand: string;
  model: string;
  status: string;
  customer?: string;
  customerProfileImageUrl?: string | null;
  assignedToName?: string;
  assignedToImageData?: string | null;
  phone?: string | null;
  address?: string | null;
  photo?: string | null;
  description?: string;
  shopName?: string;
  serviceType?: 'shop_visit' | 'home_service' | null;
  quotationAmount?: number | null;
  quotationCurrency?: string;
  assignedAt: string;
  createdAt?: string;
  scheduledDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  repairTimeMinutes?: number | null;
  repairTimeFormatted?: string | null;
  cost?: number | null;
  rating?: number | null;
  reviewText?: string | null;
  completionDescription?: string | null;
  workPerformed?: string | null;
  partsReplaced?: string | null;
  finalNotes?: string | null;
  pickupInstructions?: string | null;
}

export interface TechnicianJobSummary {
  assigned: number;
  pending?: number;
  active?: number;
  inProgress: number;
  completed: number;
  totalCompleted?: number;
  devicesRepaired?: number;
  averageRepairTimeHours?: number | null;
  averageRating?: number | null;
  onHold: number;
  today: number;
}

export interface TechnicianDashboardData {
  kpis: {
    totalAssigned: number;
    pendingJobs: number;
    activeJobs: number;
    completedJobs: number;
    todayJobs: number;
  };
  currentlyActiveJob: TechnicianJob | null;
  todaySchedule: TechnicianJob[];
  recentlyAssigned: TechnicianJob[];
  upcomingJobs: TechnicianJob[];
  recentMessages: Array<{
    id: string;
    requestId: string;
    appliance: string;
    customerName: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
  }>;
  recentNotifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    link?: string;
  }>;
  recentActivity?: Array<{
    type: string;
    title: string;
    subtitle: string;
    at: string;
  }>;
  technician: Technician;
}

export interface TechnicianSearchResult {
  id: string;
  title: string;
  details: string;
  status: string;
  route: string[];
  queryParams: Record<string, string>;
}

export interface TechnicianTimelineEvent {
  action: string;
  notes: string;
  at: string;
  actorName: string;
  actorRole: string;
}

export interface TechnicianActivity {
  requestId?: string;
  appliance?: string;
  action: string;
  reason?: string;
  at: string;
  actor: string;
}

export interface TechnicianListResponse {
  technicians: Technician[];
  summary: TechnicianSummary;
}

export interface TechnicianInput {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  password?: string;
  employeeId: string;
  skills: string[];
  specialization: string;
  experienceYears: number;
  employmentType: TechnicianEmploymentType;
  joiningDate: string;
  profileImageData?: string;
  status?: TechnicianStatus;
  availabilityPreference?: 'available' | 'on_leave';
}

export interface TechnicianAssignment {
  requestId: string;
  appliance: string;
  brand: string;
  model: string;
  description?: string;
  photo?: string | null;
  createdAt?: string;
  serviceType?: 'shop_visit' | 'home_service' | null;
  repairStatus: string;
  customer: string;
  customerProfileImageUrl?: string | null;
  assignment: { technicianId: string; assignedAt: string; note?: string };
  isOwner: boolean;
  technician:
    | Technician
    | {
        id: string;
        name: string;
        availability: string;
        workload: number;
        employeeId?: string;
        profileImageData?: string | null;
      }
    | null;
}

export interface TechnicianRepairDetails extends TechnicianJob {
  shopId: string;
  description: string;
  photos: Array<{ mimeType: string; data: string }>;
  customer: string;
  createdAt?: string;
  requestStatus?: string;
  phone: string | null;
  location?: { latitude: number; longitude: number } | null;
  serviceType: 'shop_visit' | 'home_service' | null;
  preferredServiceDate?: string | null;
  customerInfo?: {
    name: string;
    phone: string | null;
    email: string | null;
    profileImageUrl?: string | null;
    location: { latitude: number; longitude: number } | null;
  };
  shop?: {
    id?: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    location: { latitude: number; longitude: number } | null;
  };
  quotation?: {
    id: string;
    amount: number;
    currency: string;
    inspectionFee: number;
    labourFee: number;
    partsFee: number;
    notes: string;
    proposedSolution?: string;
    warrantyInformation?: string;
    estimatedDays?: number | null;
    approvedAt?: string | null;
  } | null;
  quotations: TechnicianQuotation[];
  shopResponse?: {
    status: string;
    declineReason?: string;
    respondedAt?: string | null;
    responseDeadline?: string | null;
  } | null;
  assignment?: {
    assignedAt: string;
    note: string;
    technicianName?: string;
  };
  assignmentDetails?: {
    assignedAt: string;
    note: string;
    technicianName?: string;
    profileImageData?: string | null;
  };
  repairJob?: RepairWorkflowJob | null;
  repairJobDetails?: RepairWorkflowJob | null;
  inspection?: RepairInspectionReport | null;
  approvedRepairAmount?: number | null;
  timeline?: TechnicianTimelineEvent[];
}

export interface TechnicianQuotation {
  id: string;
  amount: number;
  currency: string;
  status: string;
  message: string;
  inspectionCharge: number;
  partsCost: number;
  labourCharge: number;
  additionalCharges: number;
  proposedSolution?: string;
  warrantyInformation?: string;
  estimatedDays?: number | null;
  inspectionCompletedBeforeQuotation?: boolean;
  requiresPhysicalPickup?: boolean;
  validUntil?: string | null;
  rejectionReason?: string;
  respondedAt?: string | null;
  createdAt?: string;
}
