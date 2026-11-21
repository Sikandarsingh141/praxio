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
  profileImageUrl?: string | null;
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
  outstandingOnly?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface ShopFinancialReport {
  period: { from: string | null; to: string | null };
  invoiceCounts: Array<{
    _id: { invoiceStatus: string; paymentStatus: string };
    count: number;
  }>;
  revenueByCurrency: Array<{
    _id: string;
    amount: number;
    invoiceCount: number;
    averageInvoiceValue: number;
  }>;
  collectionsByMethod: Array<{
    _id: { currency: string; method: RepairInvoicePaymentMethod };
    amount: number;
    paymentCount: number;
  }>;
  outstandingByCurrency: Array<{
    _id: string;
    amount: number;
    invoiceCount: number;
  }>;
  taxByRate: Array<{
    _id: { currency: string; type: 'CGST' | 'SGST' | 'IGST'; rate: number };
    amount: number;
  }>;
  revenueByCategory: Array<{
    _id: { currency: string; category: string };
    amount: number;
  }>;
  revenueTrend: Array<{
    _id: { currency: string; date: string };
    amount: number;
  }>;
  recentTransactions: ShopFinancialTransaction[];
  completedRepairs: number;
  refunds: { trackingAvailable: boolean; totals: unknown[]; count: number };
}

export interface ShopFinancialReportFilters {
  from?: string;
  to?: string;
}

export interface ShopFinancialTransaction {
  transactionId: string;
  repairRequestId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  customerName: string;
  profileImageUrl?: string | null;
  paymentDate: string;
  method: RepairInvoicePaymentMethod;
  status: RepairInvoicePayment['status'];
  currency: string;
  amount: number;
  invoiceAmount: number;
  amountPaid: number;
  outstanding: number;
  reference: string | null;
}

export interface ShopFinancialTransactionsFilters extends ShopFinancialReportFilters {
  search?: string;
  method?: RepairInvoicePaymentMethod | '';
  status?: RepairInvoicePayment['status'] | '';
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ShopFinancialTransactionsPage {
  transactions: ShopFinancialTransaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface RecordRepairInvoicePaymentInput {
  amount: number;
  method: Exclude<RepairInvoicePaymentMethod, 'stripe'>;
  reference?: string;
  paymentDate: string;
}
