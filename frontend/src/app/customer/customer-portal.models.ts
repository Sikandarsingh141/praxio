export interface ShopSearchResult {
  id: string;
  shopName: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  services: string[];
  address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  location: { latitude: number; longitude: number } | null;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
  logoUrl: string | null;
  availability: 'unknown' | 'available' | 'unavailable';
  phone: string | null;
  email: string;
}

export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export interface RepairQuotation {
  _id: string;
  repairRequestId: string;
  shopId: string;
  amount: number;
  currency: string;
  message: string;
  estimatedDays?: number;
  inspectionCharge?: number;
  partsCost?: number;
  labourCharge?: number;
  additionalCharges?: number;
  proposedSolution?: string;
  warrantyInformation?: string;
  additionalNotes?: string;
  validUntil?: string;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'declined' | 'expired' | 'withdrawn';
  rejectionReason?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface CustomerQuotation extends RepairQuotation {
  repairRequest: {
    _id: string;
    appliance: string;
    brand?: string;
    model?: string;
    description: string;
    preferredServiceDate?: string;
    serviceType?: 'shop_visit' | 'home_service';
  };
  shop: {
    id: string;
    shopName: string;
    address: string;
    rating: number | null;
    reviewCount: number;
    logoUrl: string | null;
  };
}

export interface QuotationListFilters {
  quotationId?: string;
  status?: 'all' | 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  search?: string;
  from?: string;
  to?: string;
  appliance?: string;
  shop?: string;
  customer?: string;
  minAmount?: number;
  maxAmount?: number;
  validity?: 'valid' | 'expired';
  sort?: 'newest' | 'oldest' | 'amount_low' | 'amount_high';
  page?: number;
  limit?: number;
}

export interface QuotationListResult<T> {
  quotations: T[];
  page: number;
  limit: number;
  total: number;
  summary: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
    withdrawn: number;
  };
}

import { RepairWorkflowJob } from '../shared/repair-workflow.models';

export interface CustomerRepairRequest {
  _id: string;
  shopIds: string[];
  appliance: string;
  brand?: string;
  model?: string;
  description: string;
  preferredServiceDate?: string;
  serviceType?: 'shop_visit' | 'home_service';
  status: 'open' | 'cancelled' | 'completed';
  createdAt: string;
  photos?: Array<{ mimeType: string; data: string }>;
  quotations: RepairQuotation[];
  shops?: Array<{ id: string; name: string; responseStatus?: string; declineReason?: string }>;
  repairJob?: RepairWorkflowJob;
  acceptedQuotation?: RepairQuotation | null;
  shop?: { id: string; name: string; address: string; phone: string | null; email: string } | null;
  review?: RepairReview | null;
}

export function customerRepairRequestStatusLabel(request: CustomerRepairRequest): string {
  if (request.status === 'cancelled') return 'Cancelled';
  if (request.status === 'completed' || request.repairJob?.status === 'completed') {
    return 'Completed';
  }
  if (request.repairJob?.status === 'disputed') return 'Disputed';
  if (request.repairJob?.status === 'repair_declined') return 'Repair declined';
  if (request.repairJob) return 'Active';
  return 'Open';
}

export interface CustomerRepairRequestFilters {
  status?: 'open' | 'cancelled' | 'completed';
  repairStatus?:
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
  appliance?: string;
  from?: string;
  to?: string;
}

export interface RepairReview {
  _id: string;
  repairRequestId: string;
  overallRating: number;
  repairQuality: number;
  communication: number;
  professionalism: number;
  timeliness: number;
  valueForMoney: number;
  title?: string;
  reviewText: string;
  liked?: string;
  improvement?: string;
  wouldRecommend: boolean;
  createdAt: string;
}
