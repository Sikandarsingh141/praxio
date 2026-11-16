import {
  RepairEstimatePart,
  RepairEstimatePartInput,
  RepairInspectionReport,
  InspectionReportInput,
} from '../../shared/models/repair-workflow.models';

export type {
  RepairEstimatePart,
  RepairEstimatePartInput,
  RepairInspectionReport,
  InspectionReportInput,
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
  phone?: string | null;
  address?: string | null;
  photo?: string | null;
  description?: string;
  shopName?: string;
  quotationAmount?: number | null;
  quotationCurrency?: string;
  assignedAt: string;
  scheduledDate?: string | null;
  completedAt?: string | null;
}

export interface TechnicianJobSummary {
  assigned: number;
  pending?: number;
  active?: number;
  inProgress: number;
  completed: number;
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
  repairStatus: string;
  customer: string;
  assignment: { technicianId: string; assignedAt: string; note?: string };
  technician:
    | Technician
    | { id: string; name: string; availability: string; workload: number; employeeId?: string }
    | null;
}

export interface TechnicianRepairDetails extends TechnicianJob {
  shopId: string;
  description: string;
  photos: Array<{ mimeType: string; data: string }>;
  customer: string;
  phone: string | null;
  location: { latitude: number; longitude: number } | null;
  serviceType: 'shop_visit' | 'home_service' | null;
  customerInfo?: {
    name: string;
    phone: string | null;
    email: string | null;
    location: { latitude: number; longitude: number } | null;
  };
  shop?: {
    id?: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
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
  assignmentDetails?: {
    assignedAt: string;
    note: string;
    technicianName?: string;
  };
  repairJobDetails?: {
    status: string;
    startedAt?: string | null;
    repairCompletedAt?: string | null;
    completionDescription?: string;
    workPerformed?: string;
    partsReplaced?: string;
    finalNotes?: string;
    pickupInstructions?: string;
    inspection?: RepairInspectionReport | null;
    approvedRepairAmount?: number | null;
  };
  inspection?: RepairInspectionReport | null;
  approvedRepairAmount?: number | null;
  timeline?: TechnicianTimelineEvent[];
}
