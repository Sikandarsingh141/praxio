export type RepairInvoiceStatus = 'draft' | 'issued' | 'cancelled';
export type RepairInvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type RepairInvoicePaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'stripe';

export interface RepairInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface RepairInvoiceParty {
  name: string;
  ownerName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoData?: string | null;
  gstin?: string | null;
}

export interface RepairInvoicePayment {
  id: string;
  amount: number;
  currency: string;
  method: RepairInvoicePaymentMethod;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  reference?: string | null;
  paymentDate: string;
  recordedAt: string;
  recordedBy: string;
}

export interface RepairInvoice {
  id: string;
  repairRequestId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  invoiceStatus: RepairInvoiceStatus;
  paymentStatus: RepairInvoicePaymentStatus;
  currency: string;
  items: RepairInvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxDetails: Array<{ type: 'CGST' | 'SGST' | 'IGST'; rate: number; amount: number }>;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  customer: RepairInvoiceParty;
  shop: RepairInvoiceParty;
  repair: {
    category: string;
    productName: string;
    brand?: string | null;
    model?: string | null;
    problemDescription: string;
    completedAt?: string | null;
    serviceType?: string | null;
  };
  payments: RepairInvoicePayment[];
  pdfAvailable: boolean;
}

export interface RepairInvoicePage {
  invoices: RepairInvoice[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RepairInvoiceListFilters {
  search?: string;
  from?: string;
  to?: string;
  paymentStatus?: RepairInvoicePaymentStatus | '';
  page?: number;
  limit?: number;
}

export interface RecordRepairInvoicePaymentInput {
  amount: number;
  method: Exclude<RepairInvoicePaymentMethod, 'stripe'>;
  reference?: string;
  paymentDate: string;
}
