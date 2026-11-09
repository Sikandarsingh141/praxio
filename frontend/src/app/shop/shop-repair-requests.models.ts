export type ShopRequestStatus =
  | 'new'
  | 'pending'
  | 'quotation_submitted'
  | 'customer_accepted'
  | 'customer_rejected'
  | 'declined'
  | 'expired';

export interface ShopRepairPhoto {
  mimeType: string;
  data: string;
}

import { RepairWorkflowJob } from '../shared/repair-workflow.models';

export interface ShopRepairRequest {
  _id: string;
  appliance: string;
  brand?: string;
  model?: string;
  description: string;
  preferredServiceDate?: string;
  serviceType?: 'shop_visit' | 'home_service';
  customerLatitude?: number;
  customerLongitude?: number;
  photos: ShopRepairPhoto[];
  status: 'open' | 'cancelled' | 'completed';
  createdAt: string;
  customer: {
    fullName: string;
    email?: string;
    phone?: string | null;
    location?: { latitude: number; longitude: number } | null;
  };
  shopResponse: {
    status: ShopRequestStatus;
    declineReason?: string;
    respondedAt?: string;
    responseDeadline?: string;
  };
  quotations: ShopQuotation[];
  acceptedQuotationId?: string;
  repairJob?: RepairWorkflowJob;
}

export interface ShopQuotation {
  _id: string;
  repairRequestId: string;
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

export interface ShopQuotationFilters {
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

export interface ShopQuotationPage {
  quotations: Array<
    ShopQuotation & {
      repairRequest: {
        _id: string;
        appliance: string;
        brand?: string;
        model?: string;
        description: string;
      };
      customer: { fullName: string };
      shop: { id: string; shopName: string };
    }
  >;
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

export interface ShopRepairRequestPage {
  requests: ShopRepairRequest[];
  page: number;
  limit: number;
  total: number;
  summary: {
    total: number;
    new: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  };
}

export interface ShopDashboardOverview {
  range: { from: string | null; to: string | null };
  requests: {
    total: number;
    new: number;
    pending: number;
    submitted: number;
    accepted: number;
    declined: number;
    expired: number;
    recent: Array<{
      _id: string;
      appliance: string;
      description: string;
      createdAt: string;
      shopResponse: { status: ShopRequestStatus };
      customer?: { fullName?: string };
      repairJob?: { status: string };
    }>;
  };
  quotations: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
    withdrawn: number;
    trend: Array<{ _id: string; count: number }>;
    recent: Array<{
      _id: string;
      repairRequestId: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      validUntil?: string;
      customerName?: string;
      appliance?: string;
    }>;
  };
  repairs: {
    total: number;
    active: number;
    confirmed: number;
    inspection_pending: number;
    inspection_in_progress: number;
    awaiting_customer_approval: number;
    inspection_approved: number;
    repair_declined: number;
    in_progress: number;
    on_hold: number;
    repair_completed: number;
    ready_for_pickup: number;
    picked_up: number;
    completed: number;
    disputed: number;
    recent: Array<{
      _id: string;
      appliance: string;
      description: string;
      updatedAt: string;
      repairJob: { status: string };
      customer?: { fullName?: string };
    }>;
  };
  reviews: {
    averageRating: number | null;
    total: number;
    fiveStar: number;
    distribution: Array<{ rating: number; count: number }>;
    recent: Array<{
      _id: string;
      overallRating: number;
      title?: string;
      reviewText: string;
      createdAt: string;
      customerName?: string;
    }>;
  };
  revenue: {
    available: boolean;
    amount?: number;
    currency?: string;
    reason?: string;
  };
}

export interface ShopReview {
  repairRequestId: string;
  customerName: string;
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
  verifiedAt: string;
  createdAt: string;
}

export interface ShopReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  distribution: Array<{ rating: number; count: number }>;
  reviews: ShopReview[];
}

export interface ShopRequestFilters {
  status?: 'all' | 'new' | 'pending' | 'accepted' | 'declined' | 'expired';
  search?: string;
  appliance?: string;
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
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
}

export interface ShopQuotationInput {
  amount: number;
  currency: string;
  message: string;
  estimatedDays: number;
  validUntil: string;
}
