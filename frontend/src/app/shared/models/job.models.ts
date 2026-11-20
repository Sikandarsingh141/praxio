import { RepairDispute } from './disputes.models';

export type CustomerJobCategory =
  | 'new'
  | 'pending'
  | 'assigned'
  | 'active'
  | 'completed'
  | 'disputed';

export type ShopJobCategory = CustomerJobCategory;
export type TechnicianJobCategory = 'assigned' | 'active' | 'completed';

export interface PendingJobQuotation {
  id: string;
  shopName: string;
  amount: number;
  currency: string;
}

export interface JobListItem {
  id: string;
  title: string;
  status: string;
  description: string;
  customerName?: string;
  customerProfileImageUrl?: string | null;
  shopName?: string;
  shopLogoUrl?: string | null;
  brand?: string;
  model?: string;
  imageData?: string | null;
  imageMimeType?: string;
  serviceType?: 'shop_visit' | 'home_service';
  createdAt: string;
  amount?: number | null;
  currency?: string;
  quotationSubmitted?: boolean;
  pendingQuotations?: PendingJobQuotation[];
  assignedToId?: string;
  assignedToName?: string;
  assignedToOwner?: boolean;
  assignedToImageData?: string | null;
  assignedAt?: string;
}

export interface JobTimelineEntry {
  title: string;
  description?: string;
  at: string;
  actorName?: string;
  actorRole?: string;
  attachmentCount?: number;
}

export interface JobAttachment {
  name: string;
  mimeType: string;
  data?: string;
  url?: string;
}

export function disputeToJobListItem(dispute: RepairDispute): JobListItem {
  return {
    id: dispute._id,
    title: dispute.repair?.appliance || dispute.subject,
    status: dispute.status,
    description: dispute.description,
    customerName: dispute.parties?.customer?.name,
    customerProfileImageUrl: dispute.parties?.customer?.profileImageUrl ?? null,
    shopName: dispute.parties?.shop?.name,
    brand: dispute.repair?.brand,
    model: dispute.repair?.model,
    imageData: dispute.repair?.photos[0]?.data ?? dispute.attachments[0]?.data ?? null,
    imageMimeType: dispute.repair?.photos[0]?.mimeType ?? dispute.attachments[0]?.mimeType,
    createdAt: dispute.createdAt,
  };
}
