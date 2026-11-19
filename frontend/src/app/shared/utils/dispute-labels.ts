import { DisputeCategory, DisputeStatus } from '../models/disputes.models';

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  same_issue_exists: 'Same Issue Still Exists',
  repair_quality: 'Repair Quality',
  device_not_working: 'Device Not Working Properly',
  new_issue_discovered: 'New Issue Discovered',
  unauthorized_work: 'Unauthorized Work',
  incorrect_charges: 'Incorrect Charges',
  overcharge: 'Overcharge',
  incomplete_repair: 'Incomplete Repair',
  item_not_returned: 'Item Not Returned',
  device_damaged: 'Device Damaged',
  shop_unresponsive: 'Shop Unresponsive',
  payment: 'Payment Issue',
  collection: 'Collection Issue',
  other: 'Other',
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under Review',
  AWAITING_SHOP_RESPONSE: 'Awaiting Shop Response',
  AWAITING_CUSTOMER_RESPONSE: 'Awaiting Customer Response',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  ACCEPTED: 'Accepted',
  REINSPECTION_IN_PROGRESS: 'Reinspection In Progress',
  AWAITING_CUSTOMER_APPROVAL: 'Awaiting Customer Approval',
  REPAIR_IN_PROGRESS: 'Repair In Progress',
  CUSTOMER_VERIFICATION_PENDING: 'Customer Verification Pending',
  CUSTOMER_CONFIRMED: 'Customer Confirmed',
  REOPENED: 'Reopened',
  RESOLUTION_PROPOSED: 'Resolution Proposed',
};

export const DISPUTE_EXPECTED_RESOLUTIONS = [
  'Refund',
  'Repair Again',
  'Replacement',
  'Apology',
  'No Further Action',
  'Other',
] as const;

export function disputeCategoryLabel(value: string): string {
  return (
    DISPUTE_CATEGORY_LABELS[value as DisputeCategory] ??
    value.replaceAll('_', ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function disputeStatusLabel(value: string): string {
  return (
    DISPUTE_STATUS_LABELS[value as DisputeStatus] ??
    value.replaceAll('_', ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}
