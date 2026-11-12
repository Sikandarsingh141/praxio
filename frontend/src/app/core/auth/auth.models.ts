export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  accountType?: 'customer' | 'shop' | 'admin';
  accountStatus?: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus?: 'active' | 'inactive' | 'suspended';
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  countryCode?: string;
  mobileNumber?: string;
  location?: { latitude: number; longitude: number };
  shopAuthorization?: ShopAuthorization;
  customerAuthorization?: CustomerAuthorization;
}

export interface CustomerAuthorization {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  accountStatus: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus?: 'active' | 'inactive' | 'suspended';
  destination: '/customer/profile' | '/customer';
  submittedAt: string | null;
  reviewedAt: string | null;
  declineReason: string | null;
}

export interface ShopAuthorization {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  accountStatus: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus?: 'active' | 'inactive' | 'suspended';
  destination: '/shop/payment' | '/shop/profile' | '/shop';
  submittedAt: string | null;
  reviewedAt: string | null;
  declineReason: string | null;
}

export interface ShopProfile {
  shopName: string;
  shopImageData?: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  address: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  landmark: string;
  location?: { latitude: number; longitude: number };
  businessAddress: string;
  services: string[];
  subscriptionPlan: 'Fixroa Shop monthly subscription';
  subscriptionAmountCents: number;
  subscriptionCurrency: 'usd';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  accountLifecycleStatus: 'active' | 'inactive' | 'suspended';
  submittedAt: string | null;
  adminApprovalStatus: 'pending' | 'approved' | 'declined' | 'not_submitted';
  declineReason: string | null;
}

export interface ShopBusinessDetailsUpdate {
  shopName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  landmark: string;
  location: { latitude: number; longitude: number } | null;
}

export interface ShopPaymentStatus {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  subscriptionPlan: 'Fixroa Shop monthly subscription';
  amountCents: number;
  currency: string;
  paidAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentIntentId: string | null;
  paymentId: string | null;
}

export interface ShopInvoice {
  stripeInvoiceId: string;
  invoiceNumber: string | null;
  totalAmountCents: number;
  amountPaidCents: number;
  refundedAmountCents: number;
  currency: string;
  status: string;
  generatedAt: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

export interface ShopInvoicePage {
  invoices: ShopInvoice[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface RegistrationNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'new_registration'
    | 'registration_approved'
    | 'registration_declined'
    | 'new_repair_request'
    | 'new_repair_quotation'
    | 'repair_request_declined'
    | 'customer_accepted_quotation'
    | 'customer_rejected_quotation'
    | 'quotation_expired'
    | 'account_activated'
    | 'account_deactivated'
    | 'account_suspended'
    | 'repair_started'
    | 'repair_marked_complete'
    | 'repair_ready_for_pickup'
    | 'repair_picked_up'
    | 'repair_disputed'
    | 'repair_review_received'
    | 'repair_job_completed'
    | 'repair_inspection_started'
    | 'repair_inspection_submitted'
    | 'repair_inspection_approved'
    | 'repair_inspection_declined'
    | 'additional_charges_requested'
    | 'additional_charges_approved'
    | 'additional_charges_declined'
    | 'new_dispute'
    | 'dispute_message'
    | 'dispute_shop_response'
    | 'dispute_resolution_proposed'
    | 'dispute_resolution_decision'
    | 'dispute_resolved'
    | 'dispute_closed'
    | 'dispute_reopened'
    | 'dispute_status_updated'
    | 'dispute_accepted'
    | 'dispute_rejected'
    | 'dispute_reinspection_started'
    | 'dispute_reinspection_submitted'
    | 'dispute_additional_charges_requested'
    | 'dispute_additional_charges_approved'
    | 'dispute_additional_charges_declined'
    | 'dispute_rework_started'
    | 'dispute_rework_progress'
    | 'dispute_rework_completed'
    | 'dispute_customer_confirmed'
    | 'dispute_issue_unresolved';
  isRead: boolean;
  createdAt: string;
  relatedEntityId?: string;
  relatedEntityType?:
    | 'registration_request'
    | 'repair_request'
    | 'repair_quotation'
    | 'repair_review'
    | 'user_account'
    | 'repair_dispute';
  link?: string;
}

export interface CustomerRegistrationRequest {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  acceptTerms: true;
  profileImageData?: string;
  notificationToken?: string;
  latitude?: number;
  longitude?: number;
}

export interface RegistrationAddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface ShopRegistrationRequest extends Omit<CustomerRegistrationRequest, 'acceptTerms'> {
  profileImageData?: string;
  shopImageData?: string;
  shopName: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  address: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  landmark: string;
  services: string[];
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface AuthUserData {
  user: UserProfile;
  redirectTo?: string;
}

export interface ShopRegistrationResult {
  user: UserProfile;
  registrationRequest: {
    id: string;
    registrationNumber: string;
    registrationStatus: 'pending';
    submittedAt: string;
  };
  checkoutUrl: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: string[];
}
