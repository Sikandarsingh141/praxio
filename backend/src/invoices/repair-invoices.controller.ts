import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import {
  RecordInvoicePaymentDto,
  ShopFinancialReportQueryDto,
  ShopFinancialTransactionsQueryDto,
  ShopInvoiceListQueryDto,
} from './repair-invoices.dto';
import { RepairInvoicesService } from './repair-invoices.service';

interface InvoiceAuthenticatedRequest extends Request {
  auth?: { userId?: string };
}

function requestUserId(request: InvoiceAuthenticatedRequest): string {
  const userId = request.auth?.userId;
  if (!userId)
    throw new UnauthorizedException(
      'Authenticated request is missing its user ID.',
    );
  return userId;
}

@Controller('shop/invoices')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
export class ShopRepairInvoicesController {
  constructor(private readonly invoices: RepairInvoicesService) {}

  @Get()
  async list(
    @Req() request: InvoiceAuthenticatedRequest,
    @Query() query: ShopInvoiceListQueryDto,
  ) {
    return {
      data: await this.invoices.listShopInvoices(requestUserId(request), query),
    };
  }

  @Get('financial-report')
  async financialReport(
    @Req() request: InvoiceAuthenticatedRequest,
    @Query() query: ShopFinancialReportQueryDto,
  ) {
    return {
      data: await this.invoices.getShopFinancialReport(
        requestUserId(request),
        query,
      ),
    };
  }

  @Get('financial-transactions')
  async financialTransactions(
    @Req() request: InvoiceAuthenticatedRequest,
    @Query() query: ShopFinancialTransactionsQueryDto,
  ) {
    return {
      data: await this.invoices.listShopFinancialTransactions(
        requestUserId(request),
        query,
      ),
    };
  }

  @Get('repair/:repairRequestId')
  async getForRepair(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('repairRequestId') repairRequestId: string,
  ) {
    return {
      data: await this.invoices.getShopInvoiceForRepair(
        requestUserId(request),
        repairRequestId,
      ),
    };
  }

  @Post('repair/:repairRequestId/draft')
  async createDraft(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('repairRequestId') repairRequestId: string,
  ) {
    return {
      data: await this.invoices.createDraft(
        requestUserId(request),
        repairRequestId,
      ),
    };
  }

  @Post(':invoiceId/preview')
  async preview(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<StreamableFile> {
    const pdf = await this.invoices.previewShopDraft(
      requestUserId(request),
      invoiceId,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'inline',
    });
  }

  @Post(':invoiceId/issue')
  async issue(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return {
      data: await this.invoices.issueInvoice(requestUserId(request), invoiceId),
    };
  }

  @Post(':invoiceId/cancel')
  async cancel(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return {
      data: await this.invoices.cancelInvoice(
        requestUserId(request),
        invoiceId,
      ),
    };
  }

  @Get(':invoiceId/pdf')
  async pdf(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<StreamableFile> {
    const file = await this.invoices.getShopInvoicePdf(
      requestUserId(request),
      invoiceId,
    );
    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${file.filename}"`,
    });
  }

  @Post(':invoiceId/payments')
  async recordPayment(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() payment: RecordInvoicePaymentDto,
  ) {
    return {
      data: await this.invoices.recordManualPayment(
        requestUserId(request),
        invoiceId,
        payment,
      ),
    };
  }
}

@Controller('customer/invoices')
@UseGuards(JwtAuthGuard)
export class CustomerRepairInvoicesController {
  constructor(private readonly invoices: RepairInvoicesService) {}

  @Get('repair/:repairRequestId')
  async getForRepair(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('repairRequestId') repairRequestId: string,
  ) {
    return {
      data: await this.invoices.getCustomerInvoiceForRepair(
        requestUserId(request),
        repairRequestId,
      ),
    };
  }

  @Get(':invoiceId/pdf')
  async pdf(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<StreamableFile> {
    const file = await this.invoices.getCustomerInvoicePdf(
      requestUserId(request),
      invoiceId,
    );
    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${file.filename}"`,
    });
  }

  @Post(':invoiceId/checkout')
  async createCheckout(
    @Req() request: InvoiceAuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return {
      data: await this.invoices.createCustomerCheckout(
        requestUserId(request),
        invoiceId,
      ),
    };
  }
}
