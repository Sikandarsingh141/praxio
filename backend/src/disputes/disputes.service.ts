import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, UpdateQuery, mongo } from 'mongoose';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RepairQuotation,
  RepairRequest,
} from '../customer/repair-request.schema';
import { User } from '../users/schemas/user.schema';
import {
  AdminDisputeStatusDto,
  CloseDisputeDto,
  CompleteDisputeReworkDto,
  CreateDisputeDto,
  DisputeAdditionalChargeDto,
  DisputeChargeDecisionDto,
  DisputeDecisionDto,
  DisputeListQueryDto,
  DisputeMessageDto,
  DisputeProgressDto,
  DisputeReinspectionDto,
  InternalDisputeNoteDto,
  ProposeDisputeResolutionDto,
  ReportUnresolvedDto,
  ResolveDisputeDto,
  ShopRejectDisputeDto,
  ShopDisputeResponseDto,
} from './dto/dispute.dto';
import {
  DISPUTE_STATUSES,
  Dispute,
  DisputeAttachment,
  DisputeMessage,
} from './schemas/dispute.schema';

export type DisputeRole = 'customer' | 'shop' | 'admin';
type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
type DisputeActor = { userId: string; role: DisputeRole };
type DisputeEvent = {
  from: DisputeStatus | 'NONE';
  to: DisputeStatus;
  actorId: Types.ObjectId;
  actorRole: DisputeRole;
  reason?: string;
  at: Date;
};

const ACTIVE_STATUSES: DisputeStatus[] = [
  'OPEN',
  'ACCEPTED',
  'REJECTED',
  'REINSPECTION_IN_PROGRESS',
  'AWAITING_CUSTOMER_APPROVAL',
  'REPAIR_IN_PROGRESS',
  'CUSTOMER_VERIFICATION_PENDING',
  'CUSTOMER_CONFIRMED',
  'REOPENED',
  'UNDER_REVIEW',
  'AWAITING_CUSTOMER_RESPONSE',
  'AWAITING_SHOP_RESPONSE',
  'RESOLUTION_PROPOSED',
];
const MAX_DISPUTE_MESSAGES = 200;
const MAX_DISPUTE_HISTORY = 500;
const MAX_ATTACHMENT_DATA_LENGTH = 10_000_000;
const DISPUTE_EVIDENCE_BUCKET = 'disputeEvidence';

const TRANSITIONS: Partial<Record<DisputeStatus, DisputeStatus[]>> = {
  OPEN: [
    'UNDER_REVIEW',
    'AWAITING_SHOP_RESPONSE',
    'AWAITING_CUSTOMER_RESPONSE',
    'RESOLUTION_PROPOSED',
    'ACCEPTED',
    'REJECTED',
    'CLOSED',
  ],
  ACCEPTED: ['REINSPECTION_IN_PROGRESS', 'REJECTED', 'CLOSED'],
  REJECTED: ['REOPENED', 'CLOSED'],
  REINSPECTION_IN_PROGRESS: [
    'AWAITING_CUSTOMER_APPROVAL',
    'REPAIR_IN_PROGRESS',
    'CLOSED',
  ],
  AWAITING_CUSTOMER_APPROVAL: [
    'REINSPECTION_IN_PROGRESS',
    'REPAIR_IN_PROGRESS',
    'CLOSED',
  ],
  REPAIR_IN_PROGRESS: ['CUSTOMER_VERIFICATION_PENDING', 'CLOSED'],
  CUSTOMER_VERIFICATION_PENDING: ['CUSTOMER_CONFIRMED', 'REOPENED', 'CLOSED'],
  CUSTOMER_CONFIRMED: ['REOPENED', 'CLOSED'],
  REOPENED: ['REINSPECTION_IN_PROGRESS', 'REJECTED', 'CLOSED'],
  CLOSED: [],
  // Keep old transitions available only to preserve existing records.
  UNDER_REVIEW: [
    'AWAITING_CUSTOMER_RESPONSE',
    'AWAITING_SHOP_RESPONSE',
    'RESOLUTION_PROPOSED',
    'RESOLVED',
    'CLOSED',
  ],
  AWAITING_CUSTOMER_RESPONSE: [
    'UNDER_REVIEW',
    'AWAITING_SHOP_RESPONSE',
    'RESOLUTION_PROPOSED',
    'RESOLVED',
    'CLOSED',
  ],
  AWAITING_SHOP_RESPONSE: [
    'UNDER_REVIEW',
    'AWAITING_CUSTOMER_RESPONSE',
    'RESOLUTION_PROPOSED',
    'RESOLVED',
    'CLOSED',
  ],
  RESOLUTION_PROPOSED: [
    'UNDER_REVIEW',
    'AWAITING_CUSTOMER_RESPONSE',
    'AWAITING_SHOP_RESPONSE',
    'RESOLVED',
    'CLOSED',
  ],
  RESOLVED: ['CLOSED', 'REOPENED'],
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectModel(Dispute.name)
    private readonly disputes: Model<Dispute>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(RepairQuotation.name)
    private readonly repairQuotations: Model<RepairQuotation>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    private readonly notifications: NotificationsService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    const disputesWithUnidentifiedCharges = await this.disputes
      .find({
        additionalCharges: {
          $elemMatch: { _id: { $exists: false } },
        },
      })
      .select('_id additionalCharges')
      .lean()
      .exec();

    for (const dispute of disputesWithUnidentifiedCharges) {
      const chargeIds: Record<string, Types.ObjectId> = {};
      dispute.additionalCharges?.forEach((charge, index) => {
        if (!charge._id) {
          chargeIds[`additionalCharges.${index}._id`] = new Types.ObjectId();
        }
      });
      if (Object.keys(chargeIds).length) {
        await this.disputes
          .updateOne(
            {
              _id: dispute._id,
              additionalCharges: {
                $elemMatch: { _id: { $exists: false } },
              },
            },
            { $set: chargeIds },
          )
          .exec();
      }
    }

    const legacyRequests = await this.repairRequests
      .find({ 'repairJob.status': 'disputed' })
      .lean()
      .exec();

    for (const request of legacyRequests) {
      if (await this.disputes.exists({ repairRequestId: request._id })) {
        continue;
      }

      const quotationId =
        request.repairJob?.acceptedQuotationId ?? request.acceptedQuotationId;
      const quotation = quotationId
        ? await this.repairQuotations.findOne({
            _id: quotationId,
            repairRequestId: request._id,
          })
        : null;
      const shopId =
        quotation?.shopId ??
        request.shopResponses?.find(
          (response) => response.status === 'customer_accepted',
        )?.shopId;

      if (!shopId) {
        this.logger.warn(
          `Legacy dispute for repair request ${request._id.toString()} was left in place because its assigned shop could not be identified.`,
        );
        continue;
      }

      const createdAt =
        request.repairJob?.history?.find((event) =>
          /disput|issue/i.test(event.action),
        )?.at ??
        request.repairJob?.pickedUpAt ??
        request.updatedAt ??
        new Date();
      const description =
        request.repairJob?.disputeDescription?.trim() ||
        'A dispute was recorded on this repair job before the dispute center was introduced.';
      const disputeId = new Types.ObjectId();
      const dispute = new this.disputes({
        _id: disputeId,
        reference: this.reference(disputeId, createdAt),
        activeIssueKey: `legacy:${request._id.toString()}`,
        repairRequestId: request._id,
        customerId: request.customerId,
        shopId,
        category: 'other',
        subject: 'Legacy repair dispute',
        normalizedSubject: this.normalizeSubject('Legacy repair dispute'),
        description,
        expectedResolution:
          'Please review the original repair issue and contact the customer.',
        attachments: [],
        customerComments: description,
        status: 'OPEN',
        priority: 'normal',
        messages: [
          {
            authorId: request.customerId,
            authorRole: 'customer',
            message: description,
            attachments: [],
            internal: false,
            createdAt,
          },
        ],
        statusHistory: [
          {
            from: 'NONE',
            to: 'OPEN',
            actorId: request.customerId,
            actorRole: 'customer',
            at: createdAt,
          },
        ],
        internalNotes: [],
        createdAt,
        updatedAt: request.updatedAt ?? createdAt,
      });

      try {
        await dispute.save();
      } catch (error) {
        if (
          this.isDuplicateKeyError(error) &&
          (await this.disputes.exists({ repairRequestId: request._id }))
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  async createCustomerDispute(
    actor: DisputeActor,
    repairRequestId: string,
    dto: CreateDisputeDto,
  ) {
    await this.assertIdentity(actor);
    const request = await this.repairRequests.findOne({
      _id: this.objectId(repairRequestId),
      customerId: this.objectId(actor.userId),
    });
    if (!request) {
      throw new NotFoundException('Repair request not found');
    }

    const quotationId =
      request.repairJob?.acceptedQuotationId ?? request.acceptedQuotationId;
    if (!request.repairJob || !quotationId) {
      throw new BadRequestException(
        'A dispute can only be opened for a repair with an accepted shop quotation.',
      );
    }
    if (!['picked_up', 'completed'].includes(request.repairJob.status)) {
      throw new BadRequestException(
        'A dispute can only be opened after the customer has received the repaired item.',
      );
    }
    const quotation = await this.repairQuotations.findOne({
      _id: quotationId,
      repairRequestId: request._id,
      status: 'accepted',
    });
    if (!quotation) {
      throw new BadRequestException(
        'The accepted shop quotation for this repair could not be verified.',
      );
    }

    const subject =
      dto.subject?.trim() ||
      `${dto.category.replaceAll('_', ' ')} after repair`;
    const now = new Date();
    const disputeId = new Types.ObjectId();
    const activeIssueKey = this.activeIssueKey(
      request._id,
      dto.category,
      subject,
    );
    const dispute = new this.disputes({
      _id: disputeId,
      reference: this.reference(disputeId, now),
      activeIssueKey,
      repairRequestId: request._id,
      customerId: request.customerId,
      shopId: quotation.shopId,
      category: dto.category,
      subject,
      normalizedSubject: this.normalizeSubject(subject),
      description: dto.description.trim(),
      expectedResolution:
        dto.expectedResolution?.trim() ||
        'Please inspect the device and address the reported issue.',
      amountInDispute: dto.amountInDispute,
      attachments: await this.validateAttachments(dto.attachments ?? [], actor),
      customerComments: dto.customerComments?.trim(),
      status: 'OPEN',
      priority: 'normal',
      messages: [],
      statusHistory: [
        {
          from: 'NONE',
          to: 'OPEN',
          actorId: request.customerId,
          actorRole: 'customer',
          at: now,
        },
      ],
      internalNotes: [],
      resolution: {},
    });

    try {
      await dispute.save();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'An active dispute for this issue already exists.',
        );
      }
      throw error;
    }

    await this.notifyRoles(
      ['shop'],
      dispute,
      'Customer raised a repair dispute',
      `${dispute.reference}: A customer reported an issue after repair.`,
      'new_dispute',
    );
    return this.visible(dispute, actor.role);
  }

  async acceptDispute(actor: DisputeActor, id: string) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Only an open dispute can be accepted.');
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {},
      'UNDER_REVIEW',
      'The shop accepted the dispute for reinspection.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Shop accepted your dispute',
      `${updated.reference}: The shop will reinspect the reported issue.`,
      'dispute_accepted',
    );
    return this.visible(updated, actor.role);
  }

  async rejectDispute(
    actor: DisputeActor,
    id: string,
    dto: ShopRejectDisputeDto,
  ) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Only an open dispute can be rejected.');
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertAttachmentCapacity(dispute, attachments);
    const now = new Date();
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          shopResponse: {
            respondedBy: this.objectId(actor.userId),
            explanation: `${dto.reason.trim()}\n\n${dto.explanation.trim()}`,
            message: dto.explanation.trim(),
            attachments,
            respondedAt: now,
          },
        },
      },
      'REJECTED',
      dto.reason.trim(),
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Shop responded to your dispute',
      `${updated.reference}: The shop rejected the dispute and provided an explanation.`,
      'dispute_rejected',
    );
    return this.visible(updated, actor.role);
  }

  async startReinspection(actor: DisputeActor, id: string) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (
      !['UNDER_REVIEW', 'ACCEPTED', 'REOPENED'].includes(dispute.status)
    ) {
      throw new BadRequestException(
        'The shop can start reinspection only after accepting or reopening a dispute.',
      );
    }
    const nextStatus =
      dispute.status === 'ACCEPTED' || dispute.status === 'REOPENED'
        ? 'REINSPECTION_IN_PROGRESS'
        : 'AWAITING_SHOP_RESPONSE';
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {},
      nextStatus,
      'The shop started reinspection.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Reinspection started',
      `${updated.reference}: The shop is inspecting the reported issue.`,
      'dispute_reinspection_started',
    );
    return this.visible(updated, actor.role);
  }

  async submitReinspection(
    actor: DisputeActor,
    id: string,
    dto: DisputeReinspectionDto,
  ) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'REINSPECTION_IN_PROGRESS' &&
      dispute.status !== 'AWAITING_SHOP_RESPONSE'
    ) {
      throw new BadRequestException(
        'Reinspection findings can only be submitted while reinspection is in progress.',
      );
    }
    const lastStatusChange = dispute.statusHistory.at(-1);
    const lastReinspection = dispute.reinspections?.at(-1);
    if (
      lastStatusChange?.to === dispute.status &&
      lastReinspection &&
      lastReinspection.submittedAt >= lastStatusChange.at
    ) {
      throw new ConflictException(
        'Reinspection findings have already been submitted for this inspection.',
      );
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertAttachmentCapacity(dispute, attachments);
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: {
          reinspections: {
            findings: dto.findings.trim(),
            identifiedProblem:
              dto.identifiedProblem?.trim() || dto.findings.trim(),
            requiredRepairWork: dto.requiredRepairWork.trim(),
            partsRequired: dto.partsRequired?.trim(),
            labourCharges: dto.labourCharges,
            otherCharges: dto.otherCharges,
            estimatedCompletionTime: dto.estimatedCompletionTime?.trim(),
            message: dto.message?.trim(),
            attachments,
            submittedBy: this.objectId(actor.userId),
            submittedAt: new Date(),
          },
        },
      },
      dispute.status === 'AWAITING_SHOP_RESPONSE'
        ? 'AWAITING_CUSTOMER_RESPONSE'
        : undefined,
      'The shop submitted reinspection findings.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Shop submitted reinspection findings',
      `${updated.reference}: Review the shop's reinspection findings.`,
      'dispute_reinspection_submitted',
    );
    return this.visible(updated, actor.role);
  }

  async requestAdditionalCharges(
    actor: DisputeActor,
    id: string,
    dto: DisputeAdditionalChargeDto,
  ) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'REINSPECTION_IN_PROGRESS' &&
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE' &&
      dispute.status !== 'AWAITING_SHOP_RESPONSE'
    ) {
      throw new BadRequestException(
        'Additional charges can only be requested after reinspection.',
      );
    }
    if (
      (dispute.additionalCharges ?? []).some(
        (charge) => charge.status === 'pending',
      )
    ) {
      throw new ConflictException(
        'There is already an additional-charge request awaiting the customer.',
      );
    }
    const items = dto.items.map((item) => ({
      description: item.description.trim(),
      amount: this.roundAmount(item.amount),
    }));
    const total = this.roundAmount(
      items.reduce((sum, item) => sum + item.amount, 0),
    );
    if (total > 1_000_000_000) {
      throw new BadRequestException(
        'The total additional charge is too large.',
      );
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: {
          additionalCharges: {
            reason: dto.reason.trim(),
            items,
            total,
            message: dto.message?.trim(),
            status: 'pending',
            requestedBy: this.objectId(actor.userId),
            requestedAt: new Date(),
          },
        },
      },
      dispute.status === 'AWAITING_CUSTOMER_RESPONSE'
        ? undefined
        : dispute.status === 'AWAITING_SHOP_RESPONSE'
          ? 'AWAITING_CUSTOMER_RESPONSE'
          : 'AWAITING_CUSTOMER_APPROVAL',
      'The shop requested customer approval for additional rework charges.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Additional rework charges need approval',
      `${updated.reference}: Review the itemized additional charge request.`,
      'dispute_additional_charges_requested',
    );
    return this.visible(updated, actor.role);
  }

  async decideAdditionalCharges(
    actor: DisputeActor,
    id: string,
    chargeId: string,
    dto: DisputeChargeDecisionDto,
  ) {
    if (actor.role !== 'customer') {
      throw new ForbiddenException(
        'Only the customer can decide these charges.',
      );
    }
    if (!Types.ObjectId.isValid(chargeId)) {
      throw new NotFoundException('Additional-charge request not found.');
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'AWAITING_CUSTOMER_APPROVAL' &&
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE'
    ) {
      throw new BadRequestException(
        'There is no additional-charge request awaiting approval.',
      );
    }
    const now = new Date();
    const accepted = dto.decision === 'accept';
    const nextStatus = accepted
      ? undefined
      : dispute.status === 'AWAITING_CUSTOMER_APPROVAL'
        ? 'REINSPECTION_IN_PROGRESS'
        : 'UNDER_REVIEW';
    if (!accepted) {
      if (!nextStatus) {
        throw new BadRequestException(
          'The additional-charge decision cannot update the dispute status.',
        );
      }
      this.assertTransition(dispute.status, nextStatus);
      if (dispute.statusHistory.length >= MAX_DISPUTE_HISTORY) {
        throw new BadRequestException(
          'This dispute has reached its status-history limit and requires support.',
        );
      }
    }
    const updated = await this.disputes
      .findOneAndUpdate(
        {
          _id: dispute._id,
          customerId: this.objectId(actor.userId),
          status: dispute.status,
          additionalCharges: {
            $elemMatch: {
              _id: new Types.ObjectId(chargeId),
              status: 'pending',
            },
          },
        },
        {
          $set: {
            'additionalCharges.$.status': accepted ? 'accepted' : 'declined',
            'additionalCharges.$.decidedBy': this.objectId(actor.userId),
            'additionalCharges.$.decidedAt': now,
            'additionalCharges.$.decisionReason':
              dto.reason?.trim() ||
              (accepted
                ? 'Customer approved the charges.'
                : 'Customer declined the charges.'),
            ...(nextStatus ? { status: nextStatus } : {}),
          },
          ...(nextStatus === undefined
            ? {}
            : {
                $push: {
                  statusHistory: {
                    from: dispute.status,
                    to: nextStatus,
                    actorId: this.objectId(actor.userId),
                    actorRole: actor.role,
                    reason:
                      dto.reason?.trim() ||
                      'The customer declined the additional charges.',
                    at: now,
                  },
                },
              }),
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'This charge request has already been decided. Refresh and try again.',
      );
    }
    await this.notifyRoles(
      ['shop'],
      updated,
      accepted
        ? 'Customer approved additional charges'
        : 'Customer declined additional charges',
      `${updated.reference}: The customer ${accepted ? 'approved' : 'declined'} the additional-charge request.`,
      accepted
        ? 'dispute_additional_charges_approved'
        : 'dispute_additional_charges_declined',
    );
    return this.visible(updated, actor.role);
  }

  async startRework(actor: DisputeActor, id: string) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    const latestCharge = dispute.additionalCharges?.at(-1);
    const newWorkflow =
      dispute.status === 'AWAITING_CUSTOMER_RESPONSE' &&
      (!latestCharge || latestCharge.status === 'accepted');
    if (
      dispute.status !== 'REINSPECTION_IN_PROGRESS' &&
      !(
        dispute.status === 'AWAITING_CUSTOMER_APPROVAL' &&
        latestCharge?.status === 'accepted'
      ) &&
      !newWorkflow
    ) {
      throw new BadRequestException(
        'Start rework after reinspection and any requested charges have been approved.',
      );
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {},
      newWorkflow ? 'AWAITING_SHOP_RESPONSE' : 'REPAIR_IN_PROGRESS',
      'The shop started the approved rework.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Rework started',
      `${updated.reference}: The shop has started work on your device.`,
      'dispute_rework_started',
    );
    return this.visible(updated, actor.role);
  }

  async addReworkProgress(
    actor: DisputeActor,
    id: string,
    dto: DisputeProgressDto,
  ) {
    this.assertShop(actor);
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'REPAIR_IN_PROGRESS' &&
      dispute.status !== 'AWAITING_SHOP_RESPONSE'
    ) {
      throw new BadRequestException(
        'Progress notes can only be added while rework is in progress.',
      );
    }
    if ((dispute.reworkProgress?.length ?? 0) >= MAX_DISPUTE_MESSAGES) {
      throw new BadRequestException(
        'This dispute has reached its progress-history limit.',
      );
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertAttachmentCapacity(dispute, attachments);
    const updated = await this.atomicUpdate(dispute, actor, {
      $push: {
        reworkProgress: {
          notes: dto.notes.trim(),
          attachments,
          submittedBy: this.objectId(actor.userId),
          submittedAt: new Date(),
        },
      },
    });
    await this.notifyRoles(
      ['customer'],
      updated,
      'Shop added rework progress',
      `${updated.reference}: The shop added a progress update.`,
      'dispute_rework_progress',
    );
    return this.visible(updated, actor.role);
  }

  async completeRework(
    actor: DisputeActor,
    id: string,
    dto: CompleteDisputeReworkDto,
  ) {
    this.assertShop(actor);
    if (!dto.tested) {
      throw new BadRequestException('Confirm that the device has been tested.');
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'REPAIR_IN_PROGRESS' &&
      dispute.status !== 'AWAITING_SHOP_RESPONSE'
    ) {
      throw new BadRequestException('Only active rework can be completed.');
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertAttachmentCapacity(dispute, attachments);
    const now = new Date();
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: {
          reworkCompletions: {
            workPerformed: dto.workPerformed.trim(),
            partsReplaced: dto.partsReplaced?.trim(),
            testingResults: dto.testingResults.trim(),
            finalNotes: dto.finalNotes?.trim(),
            tested: true,
            attachments,
            completedBy: this.objectId(actor.userId),
            completedAt: now,
          },
        },
      },
      dispute.status === 'AWAITING_SHOP_RESPONSE'
        ? 'AWAITING_CUSTOMER_RESPONSE'
        : 'CUSTOMER_VERIFICATION_PENDING',
      'The shop completed and tested the rework; customer verification is pending.',
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Your device is ready for verification',
      `${updated.reference}: The shop completed and tested the rework. Please inspect the device and confirm whether the issue is resolved.`,
      'dispute_rework_completed',
    );
    return this.visible(updated, actor.role);
  }

  async confirmResolution(
    actor: DisputeActor,
    id: string,
    dto: DisputeMessageDto,
  ) {
    if (actor.role !== 'customer') {
      throw new ForbiddenException('Only the customer can verify the rework.');
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'CUSTOMER_VERIFICATION_PENDING' &&
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE'
    ) {
      throw new BadRequestException(
        'This dispute is not awaiting customer verification.',
      );
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertAttachmentCapacity(dispute, attachments);
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: {
          verificationHistory: {
            comments: dto.message.trim(),
            attachments,
            confirmedBy: this.objectId(actor.userId),
            confirmedAt: new Date(),
          },
        },
      },
      dispute.status === 'AWAITING_CUSTOMER_RESPONSE'
        ? 'RESOLVED'
        : 'CUSTOMER_CONFIRMED',
      dto.message.trim(),
    );
    await this.notifyRoles(
      ['shop'],
      updated,
      'Customer confirmed the repair',
      `${updated.reference}: The customer confirmed that the issue is resolved. Close the dispute when ready.`,
      'dispute_customer_confirmed',
    );
    return this.visible(updated, actor.role);
  }

  async reportUnresolved(
    actor: DisputeActor,
    id: string,
    dto: ReportUnresolvedDto,
  ) {
    if (actor.role !== 'customer') {
      throw new ForbiddenException(
        'Only the customer can report an unresolved issue.',
      );
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !== 'CUSTOMER_VERIFICATION_PENDING' &&
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE' &&
      dispute.status !== 'CUSTOMER_CONFIRMED' &&
      dispute.status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        'Report an unresolved issue after the shop has completed the rework.',
      );
    }
    const attachments = await this.validateAttachments(dto.attachments ?? [], actor);
    this.assertConversationCapacity(dispute, false, attachments);
    const now = new Date();
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: {
          messages: {
            authorId: this.objectId(actor.userId),
            authorRole: actor.role,
            message: dto.notes.trim(),
            attachments,
            internal: false,
            createdAt: now,
          },
        },
        $unset: {
          'resolution.customerAcceptedAt': 1,
          'resolution.shopAcceptedAt': 1,
        },
      },
      'REOPENED',
      dto.notes.trim(),
    );
    await this.notifyRoles(
      ['shop'],
      updated,
      'Customer reports the issue remains',
      `${updated.reference}: The customer reports that the issue is still not resolved.`,
      'dispute_issue_unresolved',
    );
    return this.visible(updated, actor.role);
  }

  async listDisputes(actor: DisputeActor, query: DisputeListQueryDto) {
    await this.assertIdentity(actor);
    const filter = await this.listFilter(actor, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const itemQuery: Promise<Dispute[]> =
      query.sort === 'priority'
        ? this.disputes
            .aggregate<Dispute>([
              { $match: filter },
              {
                $addFields: {
                  priorityRank: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$priority', 'urgent'] }, then: 4 },
                        { case: { $eq: ['$priority', 'high'] }, then: 3 },
                        { case: { $eq: ['$priority', 'normal'] }, then: 2 },
                        { case: { $eq: ['$priority', 'low'] }, then: 1 },
                      ],
                      default: 0,
                    },
                  },
                },
              },
              { $sort: { priorityRank: -1, updatedAt: -1 } },
              { $skip: (page - 1) * limit },
              { $limit: limit },
              { $unset: 'priorityRank' },
            ])
            .exec()
        : this.disputes
            .find(filter)
            .sort(
              query.sort === 'oldest' ? { createdAt: 1 } : { updatedAt: -1 },
            )
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
    const [items, total] = await Promise.all([
      itemQuery,
      this.disputes.countDocuments(filter),
    ]);

    const summary = await this.disputes.aggregate([
      {
        $match: Object.fromEntries(
          Object.entries(filter).filter(([key]) => key !== 'status'),
        ),
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const summaryCounts = Object.fromEntries(
      summary.map((row: { _id: string; count: number }) => [
        row._id,
        row.count,
      ]),
    );

    return {
      items: items.map((item) => this.visible(item, actor.role)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        ...summaryCounts,
        TOTAL: summary.reduce(
          (sum: number, row: { count: number }) => sum + row.count,
          0,
        ),
      },
    };
  }

  async getDispute(actor: DisputeActor, id: string) {
    const dispute = await this.findAccessible(actor, id);
    const [request, customer, shop] = await Promise.all([
      this.repairRequests.findById(dispute.repairRequestId).lean(),
      this.users.findById(dispute.customerId).select('fullName email').lean(),
      this.users
        .findById(dispute.shopId)
        .select('fullName email shopDetails.shopName')
        .lean(),
    ]);
    if (!request) {
      throw new NotFoundException('Related repair request not found');
    }

    const quotationId =
      request.repairJob?.acceptedQuotationId ?? request.acceptedQuotationId;
    const quotation = quotationId
      ? await this.repairQuotations.findById(quotationId).lean()
      : null;

    return {
      ...this.visible(dispute, actor.role),
      parties: {
        customer: customer
          ? {
              id: customer._id.toString(),
              name: customer.fullName,
              ...(actor.role === 'admin' ? { email: customer.email } : {}),
            }
          : null,
        shop: shop
          ? {
              id: shop._id.toString(),
              name: shop.shopDetails?.shopName ?? shop.fullName,
              ...(actor.role === 'admin' ? { email: shop.email } : {}),
            }
          : null,
      },
      repair: {
        id: request._id.toString(),
        appliance: request.appliance,
        brand: request.brand,
        model: request.model,
        description: request.description,
        photos: request.photos,
        status: request.status,
        createdAt: request.createdAt,
        repairJob: request.repairJob,
        quotation: quotation
          ? {
              amount: quotation.amount,
              currency: quotation.currency,
              message: quotation.message,
              proposedSolution: quotation.proposedSolution,
            }
          : null,
      },
    };
  }

  async getAttachment(actor: DisputeActor, id: string, fileId: string) {
    const dispute = await this.findAccessible(actor, id);
    if (!Types.ObjectId.isValid(fileId)) {
      throw new NotFoundException('Attachment not found.');
    }
    const attachment = this.findAttachmentReference(dispute, fileId);
    if (!attachment?.fileId) {
      throw new NotFoundException('Attachment not found.');
    }
    const bucket = this.gridFsBucket();
    const exists = await this.database()
      .collection(`${DISPUTE_EVIDENCE_BUCKET}.files`)
      .findOne({ _id: new Types.ObjectId(fileId) });
    if (!exists) throw new NotFoundException('Attachment not found.');
    return {
      stream: bucket.openDownloadStream(new Types.ObjectId(fileId)),
      mimeType: attachment.mimeType,
      name: attachment.name,
    };
  }

  async sendMessage(actor: DisputeActor, id: string, dto: DisputeMessageDto) {
    const dispute = await this.findAccessible(actor, id);
    this.assertActive(dispute);
    const authorId = this.objectId(actor.userId);
    const message = {
      authorId,
      authorRole: actor.role,
      message: dto.message.trim(),
      attachments: await this.validateAttachments(dto.attachments ?? [], actor),
      internal: false,
      createdAt: new Date(),
    };
    this.assertConversationCapacity(
      dispute,
      actor.role === 'admin',
      message.attachments,
    );
    const isLegacyResponse =
      (actor.role === 'customer' &&
        dispute.status === 'AWAITING_CUSTOMER_RESPONSE') ||
      (actor.role === 'shop' && dispute.status === 'AWAITING_SHOP_RESPONSE');
    const nextStatus = isLegacyResponse ? 'UNDER_REVIEW' : undefined;

    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $push: { messages: message },
      },
      nextStatus,
      'A participant provided additional information.',
    );
    const recipientRoles =
      actor.role === 'admin'
        ? (['customer', 'shop'] as const)
        : actor.role === 'customer'
          ? (['shop', 'admin'] as const)
          : (['customer', 'admin'] as const);
    await this.notifyRoles(
      recipientRoles,
      updated,
      'New dispute message',
      `${updated.reference} has a new message.`,
      'dispute_message',
    );
    return this.visible(updated, actor.role);
  }

  async respondAsShop(
    actor: DisputeActor,
    id: string,
    dto: ShopDisputeResponseDto,
  ) {
    const dispute = await this.findAccessible(actor, id);
    if (actor.role !== 'shop') {
      throw new ForbiddenException('Only the assigned shop can respond here.');
    }
    this.assertActive(dispute);
    const now = new Date();
    const response = {
      respondedBy: this.objectId(actor.userId),
      explanation: dto.explanation.trim(),
      proposedResolution: dto.proposedResolution?.trim(),
      message: dto.message.trim(),
      attachments: await this.validateAttachments(dto.attachments ?? [], actor),
      respondedAt: now,
    };
    const message = {
      authorId: this.objectId(actor.userId),
      authorRole: 'shop' as const,
      message: dto.message.trim(),
      attachments: response.attachments,
      internal: false,
      createdAt: now,
    };
    this.assertConversationCapacity(dispute, false, [
      ...response.attachments,
      ...response.attachments,
    ]);
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: { shopResponse: response },
        $push: { messages: message },
      },
      dispute.status === 'OPEN' || dispute.status === 'AWAITING_SHOP_RESPONSE'
        ? 'UNDER_REVIEW'
        : undefined,
      'The assigned shop submitted its response.',
    );
    await this.notifyRoles(
      ['customer', 'admin'],
      updated,
      'Shop responded to dispute',
      `${updated.reference} has a response from the shop.`,
      'dispute_shop_response',
    );
    return this.visible(updated, actor.role);
  }

  async addInternalNote(
    actor: DisputeActor,
    id: string,
    dto: InternalDisputeNoteDto,
  ) {
    const dispute = await this.findAccessible(actor, id);
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Administrator access required.');
    }
    const note: DisputeMessage = {
      authorId: this.objectId(actor.userId),
      authorRole: 'admin',
      message: dto.message.trim(),
      attachments: await this.validateAttachments(dto.attachments ?? [], actor),
      internal: true,
      createdAt: new Date(),
    };
    this.assertConversationCapacity(dispute, true, note.attachments);
    const updated = await this.disputes
      .findByIdAndUpdate(
        dispute._id,
        { $push: { internalNotes: note } },
        { new: true, runValidators: true },
      )
      .orFail(new NotFoundException('Dispute not found'))
      .exec();
    return this.visible(updated, actor.role);
  }

  async updateAdminStatus(
    actor: DisputeActor,
    id: string,
    dto: AdminDisputeStatusDto,
  ) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Administrator access required.');
    }
    const dispute = await this.findAccessible(actor, id);
    if (dto.status === 'RESOLVED' || dto.status === 'CLOSED') {
      throw new BadRequestException(
        'Use the dedicated resolve, close, or reopen action for this status.',
      );
    }
    this.assertTransition(dispute.status, dto.status);
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          ...(dto.priority ? { priority: dto.priority } : {}),
        },
      },
      dto.status,
      dto.reason.trim(),
    );
    await this.notifyStatusChange(updated, dispute.status, actor);
    return this.visible(updated, actor.role);
  }

  async proposeResolution(
    actor: DisputeActor,
    id: string,
    dto: ProposeDisputeResolutionDto,
  ) {
    const dispute = await this.findAccessible(actor, id);
    if (dispute.resolution?.state === 'proposed') {
      throw new ConflictException(
        'An existing resolution proposal must be decided before another can be submitted.',
      );
    }
    const proposedStatus =
      actor.role === 'customer'
        ? 'AWAITING_SHOP_RESPONSE'
        : 'AWAITING_CUSTOMER_RESPONSE';
    this.assertTransition(dispute.status, proposedStatus);
    if (
      ['partial_refund', 'full_refund'].includes(dto.type) &&
      dto.amount === undefined
    ) {
      throw new BadRequestException(
        'Enter the refund amount in the proposed resolution.',
      );
    }
    const resolutionDocuments = await this.validateAttachments(dto.documents ?? [], actor);
    this.assertAttachmentCapacity(dispute, resolutionDocuments);
    const now = new Date();
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          'resolution.type': dto.type,
          'resolution.description': dto.description.trim(),
          'resolution.amount': dto.amount,
          'resolution.responsibleParty': dto.responsibleParty,
          'resolution.notes': dto.notes.trim(),
          'resolution.decision':
            actor.role === 'admin' ? 'admin_decision' : 'mutual_acceptance',
          ...(actor.role === 'admin'
            ? { 'resolution.decisionExplanation': dto.notes.trim() }
            : {}),
          'resolution.state': 'proposed',
          'resolution.documents': resolutionDocuments,
          'resolution.proposedAt': now,
          'resolution.proposedBy': this.objectId(actor.userId),
          'resolution.requiredActionCompleted': false,
        },
        $unset: {
          'resolution.customerAcceptedAt': 1,
          'resolution.customerAcceptedBy': 1,
          'resolution.shopAcceptedAt': 1,
          'resolution.shopAcceptedBy': 1,
          'resolution.customerRejectionReason': 1,
          'resolution.shopRejectionReason': 1,
          'resolution.resolvedAt': 1,
          'resolution.resolvedBy': 1,
          'resolution.closedAt': 1,
          'resolution.closedBy': 1,
          'resolution.refundTransactionId': 1,
          'resolution.completionNotes': 1,
          'resolution.completionDocuments': 1,
        },
      },
      proposedStatus,
      `The ${actor.role} proposed a resolution.`,
    );
    await this.notifyRoles(
      ['customer', 'shop'],
      updated,
      'Dispute resolution proposed',
      `A proposed resolution is available for ${updated.reference}.`,
      'dispute_resolution_proposed',
    );
    return this.visible(updated, actor.role);
  }

  async decideResolution(
    actor: DisputeActor,
    id: string,
    dto: DisputeDecisionDto,
  ) {
    if (actor.role === 'admin') {
      throw new ForbiddenException(
        'Only the customer or assigned shop can decide.',
      );
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      dispute.status !==
        (actor.role === 'customer'
          ? 'AWAITING_CUSTOMER_RESPONSE'
          : 'AWAITING_SHOP_RESPONSE') ||
      dispute.resolution?.state !== 'proposed'
    ) {
      throw new BadRequestException(
        'There is no proposed resolution to decide.',
      );
    }
    const now = new Date();
    const field =
      actor.role === 'customer'
        ? 'resolution.customerAcceptedAt'
        : 'resolution.shopAcceptedAt';
    const actorField =
      actor.role === 'customer'
        ? 'resolution.customerAcceptedBy'
        : 'resolution.shopAcceptedBy';
    const rejectionField =
      actor.role === 'customer'
        ? 'resolution.customerRejectionReason'
        : 'resolution.shopRejectionReason';
    if (dto.decision === 'accept' && dispute.resolution?.[actor.role === 'customer' ? 'customerAcceptedAt' : 'shopAcceptedAt']) {
      throw new ConflictException('You have already accepted this resolution.');
    }
    const update: UpdateQuery<Dispute> =
      dto.decision === 'accept'
        ? {
            $set: {
              [field]: now,
              [actorField]: this.objectId(actor.userId),
            },
            $unset: { [rejectionField]: 1 },
          }
        : {
            $set: {
              [rejectionField]:
                dto.reason?.trim() || 'The proposal was rejected.',
              'resolution.state': 'draft',
            },
            $unset: {
              'resolution.customerAcceptedAt': 1,
              'resolution.customerAcceptedBy': 1,
              'resolution.shopAcceptedAt': 1,
              'resolution.shopAcceptedBy': 1,
            },
          };
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      update,
      dto.decision === 'reject' ||
        (actor.role === 'customer'
          ? Boolean(dispute.resolution?.shopAcceptedAt)
          : Boolean(dispute.resolution?.customerAcceptedAt))
        ? 'UNDER_REVIEW'
        : actor.role === 'customer'
          ? 'AWAITING_SHOP_RESPONSE'
          : 'AWAITING_CUSTOMER_RESPONSE',
      dto.decision === 'reject'
        ? `${actor.role} rejected the proposed resolution: ${dto.reason?.trim() || 'No reason given'}`
        : `${actor.role} accepted the proposed resolution.`,
    );
    await this.notifyRoles(
      ['admin', actor.role === 'customer' ? 'shop' : 'customer'],
      updated,
      dto.decision === 'accept' ? 'Resolution accepted' : 'Resolution rejected',
      `${actor.role === 'customer' ? 'The customer' : 'The shop'} ${dto.decision === 'accept' ? 'accepted' : 'rejected'} the resolution for ${updated.reference}.`,
      'dispute_resolution_decision',
    );
    return this.visible(updated, actor.role);
  }

  async resolveDispute(
    actor: DisputeActor,
    id: string,
    dto: ResolveDisputeDto,
  ) {
    const dispute = await this.findAccessible(actor, id);
    if (
      ![
        'UNDER_REVIEW',
        'AWAITING_CUSTOMER_RESPONSE',
        'AWAITING_SHOP_RESPONSE',
      ].includes(dispute.status)
    ) {
      throw new BadRequestException(
        'A dispute must have an active proposed resolution before it can be resolved.',
      );
    }
    const resolution = dispute.resolution;
    if (!resolution?.type || resolution.state !== 'proposed') {
      throw new BadRequestException('A proposed resolution is required.');
    }
    if (
      actor.role !== 'admin' &&
      (!resolution.customerAcceptedAt || !resolution.shopAcceptedAt)
    ) {
      throw new BadRequestException(
        'Both parties must accept the proposed resolution before it can be resolved.',
      );
    }
    if (
      (resolution.type === 'partial_refund' ||
        resolution.type === 'full_refund') &&
      !dto.refundTransactionId?.trim()
    ) {
      throw new BadRequestException(
        'Provide the actual refund transaction ID before resolving a refund.',
      );
    }
    if (
      (resolution.type === 'partial_refund' ||
        resolution.type === 'full_refund') &&
      resolution.amount === undefined
    ) {
      throw new BadRequestException(
        'Enter the refund amount in the proposed resolution.',
      );
    }
    const completionDocuments = await this.validateAttachments(dto.documents ?? [], actor);
    this.assertAttachmentCapacity(dispute, completionDocuments);
    if (
      [
        'repair_again',
        'additional_repair',
        'customer_compensation',
        'shop_compensation',
      ].includes(resolution.type) &&
      (!dto.requiredActionCompleted || completionDocuments.length === 0)
    ) {
      throw new BadRequestException(
        'Confirm completion and attach evidence of the required repair or compensation action.',
      );
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          'resolution.state': 'final',
          'resolution.resolvedAt': new Date(),
          'resolution.resolvedBy': this.objectId(actor.userId),
          'resolution.completionNotes': dto.completionNotes.trim(),
          'resolution.refundTransactionId': dto.refundTransactionId?.trim(),
          'resolution.requiredActionCompleted': Boolean(
            dto.requiredActionCompleted,
          ),
          'resolution.completionDocuments': completionDocuments,
        },
      },
      'RESOLVED',
      dto.completionNotes.trim(),
    );
    await this.notifyRoles(
      ['customer', 'shop'],
      updated,
      'Dispute resolved',
      `${updated.reference} has been marked resolved by the ${actor.role}.`,
      'dispute_resolved',
    );
    return this.visible(updated, actor.role);
  }

  async closeDispute(actor: DisputeActor, id: string, dto: CloseDisputeDto) {
    if (actor.role !== 'admin' && actor.role !== 'shop') {
      throw new ForbiddenException(
        'Only the assigned shop or an administrator can close a dispute.',
      );
    }
    const dispute = await this.findAccessible(actor, id);
    if (
      actor.role === 'shop' &&
      dispute.status !== 'CUSTOMER_CONFIRMED' &&
      dispute.status !== 'RESOLVED'
    ) {
      throw new BadRequestException(
        'The shop can close the dispute only after the customer confirms the rework.',
      );
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          closedBy: this.objectId(actor.userId),
          disputeClosedAt: new Date(),
        },
      },
      'CLOSED',
      dto.reason.trim(),
    );
    await this.notifyRoles(
      ['customer'],
      updated,
      'Dispute closed',
      `${updated.reference} has been closed by the ${actor.role}.`,
      'dispute_closed',
    );
    return this.visible(updated, actor.role);
  }

  async reopenDispute(actor: DisputeActor, id: string, dto: CloseDisputeDto) {
    const dispute = await this.findAccessible(actor, id);
    if (actor.role === 'admin') {
      throw new ForbiddenException(
        'Only the customer or assigned shop can reopen.',
      );
    }
    if (dispute.status !== 'RESOLVED' && dispute.status !== 'CLOSED') {
      throw new BadRequestException(
        'Only a resolved or closed dispute can be reopened.',
      );
    }
    const updated = await this.atomicUpdate(
      dispute,
      actor,
      {
        $set: {
          activeIssueKey: this.activeIssueKey(
            dispute.repairRequestId,
            dispute.category,
            dispute.normalizedSubject,
          ),
          'resolution.state': 'draft',
          'resolution.requiredActionCompleted': false,
        },
        $unset: {
          'resolution.customerAcceptedAt': 1,
          'resolution.customerAcceptedBy': 1,
          'resolution.shopAcceptedAt': 1,
          'resolution.shopAcceptedBy': 1,
          'resolution.customerRejectionReason': 1,
          'resolution.shopRejectionReason': 1,
          'resolution.resolvedAt': 1,
          'resolution.resolvedBy': 1,
          'resolution.closedAt': 1,
          'resolution.closedBy': 1,
          'resolution.refundTransactionId': 1,
          'resolution.completionNotes': 1,
          'resolution.completionDocuments': 1,
        },
      },
      'REOPENED',
      dto.reason.trim(),
    );
    await this.notifyRoles(
      ['admin', actor.role === 'customer' ? 'shop' : 'customer'],
      updated,
      'Dispute reopened',
      `${updated.reference} has been reopened for further review.`,
      'dispute_reopened',
    );
    return this.visible(updated, actor.role);
  }

  private async listFilter(actor: DisputeActor, query: DisputeListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (actor.role === 'customer') {
      filter.customerId = this.objectId(actor.userId);
    } else if (actor.role === 'shop') {
      filter.shopId = this.objectId(actor.userId);
    }
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;

    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = this.parseDate(query.from, false);
      if (query.to) createdAt.$lte = this.parseDate(query.to, true);
      if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
        throw new BadRequestException(
          'The start date must not be later than the end date.',
        );
      }
      filter.createdAt = createdAt;
    }
    const term = query.search?.trim();
    if (term) {
      const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeTerm, 'i');
      const userIds = await this.users
        .find({
          $or: [
            { fullName: regex },
            { email: regex },
            { 'shopDetails.shopName': regex },
          ],
        })
        .select('_id')
        .limit(100)
        .lean();
      const or: Record<string, unknown>[] = [
        { reference: regex },
        { subject: regex },
        { description: regex },
      ];
      if (Types.ObjectId.isValid(term)) {
        const objectId = new Types.ObjectId(term);
        or.push({ _id: objectId }, { repairRequestId: objectId });
      }
      if (userIds.length) {
        const ids = userIds.map((user) => user._id);
        or.push({ customerId: { $in: ids } }, { shopId: { $in: ids } });
      }
      filter.$or = or;
    }
    return filter;
  }

  private parseDate(value: string, endOfDay: boolean): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Date filters must use YYYY-MM-DD format.');
    }
    const date = new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
    );
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Date filter is invalid.');
    }
    return date;
  }

  private async findAccessible(actor: DisputeActor, id: string) {
    await this.assertIdentity(actor);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Dispute not found');
    }
    const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) };
    if (actor.role === 'customer')
      filter.customerId = this.objectId(actor.userId);
    if (actor.role === 'shop') filter.shopId = this.objectId(actor.userId);
    const dispute = await this.disputes.findOne(filter).exec();
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    return dispute;
  }

  private async atomicUpdate(
    dispute: Dispute,
    actor: DisputeActor,
    update: UpdateQuery<Dispute>,
    nextStatus?: DisputeStatus,
    reason?: string,
  ) {
    const updateDoc: UpdateQuery<Dispute> = {
      $set: { ...(update.$set ?? {}) },
      ...(update.$push ? { $push: { ...update.$push } } : {}),
      ...(update.$unset ? { $unset: { ...update.$unset } } : {}),
    };
    const now = new Date();
    if (nextStatus && nextStatus !== dispute.status) {
      this.assertTransition(dispute.status, nextStatus);
      if (dispute.statusHistory.length >= MAX_DISPUTE_HISTORY) {
        throw new BadRequestException(
          'This dispute has reached its status-history limit and requires support.',
        );
      }
      updateDoc.$set = { ...(updateDoc.$set ?? {}), status: nextStatus };
      updateDoc.$push = {
        ...(updateDoc.$push ?? {}),
        statusHistory: {
          from: dispute.status,
          to: nextStatus,
          actorId: this.objectId(actor.userId),
          actorRole: actor.role,
          reason,
          at: now,
        } satisfies DisputeEvent,
      };
      if (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') {
        updateDoc.$unset = { activeIssueKey: 1 };
      }
    }
    const result = await this.disputes
      .findOneAndUpdate(
        { _id: dispute._id, status: dispute.status },
        updateDoc,
        { new: true, runValidators: true },
      )
      .exec();
    if (!result) {
      throw new ConflictException(
        'The dispute changed while you were working. Refresh and try again.',
      );
    }
    return result;
  }

  private assertTransition(from: DisputeStatus, to: DisputeStatus): void {
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(
        `The dispute cannot move from ${from} to ${to}.`,
      );
    }
  }

  private assertActive(dispute: Dispute): void {
    if (!ACTIVE_STATUSES.includes(dispute.status)) {
      throw new BadRequestException(
        'This dispute is no longer active and cannot receive messages.',
      );
    }
  }

  private assertConversationCapacity(
    dispute: Dispute,
    internal: boolean,
    attachments: DisputeAttachment[],
  ): void {
    const count = internal
      ? dispute.internalNotes.length
      : dispute.messages.length;
    if (count >= MAX_DISPUTE_MESSAGES) {
      throw new BadRequestException(
        'This dispute has reached its message limit. Contact Fixroa Support.',
      );
    }
    this.assertAttachmentCapacity(dispute, attachments);
  }

  private assertAttachmentCapacity(
    dispute: Dispute,
    additions: DisputeAttachment[],
  ): void {
    const existing = [
      ...dispute.attachments,
      ...dispute.messages.flatMap((message) => message.attachments),
      ...dispute.internalNotes.flatMap((note) => note.attachments),
      ...(dispute.shopResponse?.attachments ?? []),
      ...(dispute.resolution?.documents ?? []),
      ...(dispute.resolution?.completionDocuments ?? []),
      ...(dispute.reinspections ?? []).flatMap((entry) => entry.attachments),
      ...(dispute.reworkProgress ?? []).flatMap((entry) => entry.attachments),
      ...(dispute.reworkCompletions ?? []).flatMap(
        (entry) => entry.attachments,
      ),
      ...(dispute.verificationHistory ?? []).flatMap(
        (entry) => entry.attachments,
      ),
    ];
    const totalLength = [...existing, ...additions].reduce(
      (sum, attachment) =>
        sum +
        (attachment.size ??
          Buffer.byteLength(attachment.data ?? '', 'utf8')),
      0,
    );
    if (totalLength > MAX_ATTACHMENT_DATA_LENGTH) {
      throw new BadRequestException(
        'This dispute has reached its evidence storage limit.',
      );
    }
  }

  private async notifyStatusChange(
    dispute: Dispute,
    previousStatus: DisputeStatus,
    actor: DisputeActor,
  ) {
    const recipientRoles =
      actor.role === 'admin'
        ? (['customer', 'shop'] as const)
        : actor.role === 'customer'
          ? (['admin', 'shop'] as const)
          : (['admin', 'customer'] as const);
    await this.notifyRoles(
      recipientRoles,
      dispute,
      'Dispute status updated',
      `${dispute.reference} moved from ${previousStatus} to ${dispute.status}.`,
      'dispute_status_updated',
    );
  }

  private async activeAdminIds(): Promise<Types.ObjectId[]> {
    const admins = await this.users
      .find({
        accountType: 'admin',
        accountStatus: 'active',
        $or: [
          { accountLifecycleStatus: 'active' },
          { accountLifecycleStatus: { $exists: false } },
        ],
      })
      .select('_id')
      .lean();
    return admins.map((admin) => admin._id);
  }

  private async notify(
    recipients: Types.ObjectId[],
    dispute: Dispute,
    title: string,
    message: string,
    type:
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
      | 'dispute_issue_unresolved',
    link: string,
  ) {
    await this.notifications.notifyUsers(recipients, {
      title,
      message,
      type,
      relatedEntityId: dispute._id,
      relatedEntityType: 'repair_dispute',
      link,
    });
  }

  private async notifyRoles(
    roles: readonly DisputeRole[],
    dispute: Dispute,
    title: string,
    message: string,
    type:
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
      | 'dispute_issue_unresolved',
  ) {
    for (const role of roles) {
      const recipients =
        role === 'admin'
          ? await this.activeAdminIds()
          : [role === 'customer' ? dispute.customerId : dispute.shopId];
      await this.notify(
        recipients,
        dispute,
        title,
        message,
        type,
        `/${role}/disputes/${dispute._id.toString()}`,
      );
    }
  }

  private async assertIdentity(actor: DisputeActor) {
    const user = await this.users
      .findById(this.objectId(actor.userId))
      .select('accountType accountStatus accountLifecycleStatus')
      .lean();
    if (
      !user ||
      user.accountType !== actor.role ||
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException('Dispute access is not available.');
    }
  }

  private assertShop(actor: DisputeActor): void {
    if (actor.role !== 'shop') {
      throw new ForbiddenException(
        'Only the assigned shop can perform this action.',
      );
    }
  }

  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private visible(
    dispute: Dispute | (Record<string, unknown> & { _id: Types.ObjectId }),
    role: DisputeRole,
  ) {
    const document = dispute as { toObject?: () => Record<string, unknown> };
    const result = document.toObject ? document.toObject() : { ...dispute };
    delete result.activeIssueKey;
    if (role !== 'admin') {
      delete result.internalNotes;
    }
    return result;
  }

  private async validateAttachments(
    attachments: DisputeAttachment[],
    actor: DisputeActor,
  ): Promise<DisputeAttachment[]> {
    if (!attachments.length) return [];
    if (attachments.length > 2) {
      throw new BadRequestException(
        'A message can include at most two attachments.',
      );
    }
    const bucket = this.gridFsBucket();
    const stored: DisputeAttachment[] = [];
    for (const attachment of attachments) {
      if (typeof attachment.data !== 'string') {
        throw new BadRequestException(
          `Attachment "${attachment.name}" must include file data.`,
        );
      }
      const base64 = attachment.data.replace(/^data:[^;]+;base64,/, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
        throw new BadRequestException(
          `Attachment "${attachment.name}" is not valid base64.`,
        );
      }
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length > 500 * 1024) {
        throw new BadRequestException(
          `Attachment "${attachment.name}" exceeds the 500 KB limit.`,
        );
      }
      this.validateAttachmentSignature(
        attachment.mimeType,
        bytes,
        attachment.name,
      );
      const upload = bucket.openUploadStream(attachment.name.trim(), {
        contentType: attachment.mimeType,
        metadata: { uploadedBy: actor.userId, uploadedRole: actor.role },
      });
      Readable.from([bytes]).pipe(upload);
      await finished(upload);
      stored.push({
        name: attachment.name.trim(),
        mimeType: attachment.mimeType,
        fileId: upload.id,
        size: bytes.length,
      });
    }
    return stored;
  }

  private database() {
    const database = this.connection.db;
    if (!database) {
      throw new ServiceUnavailableException(
        'Dispute evidence storage is unavailable.',
      );
    }
    return database;
  }

  private gridFsBucket(): mongo.GridFSBucket {
    return new mongo.GridFSBucket(this.database(), {
      bucketName: DISPUTE_EVIDENCE_BUCKET,
    });
  }

  private findAttachmentReference(
    dispute: Dispute,
    fileId: string,
  ): DisputeAttachment | undefined {
    const attachments = [
      ...dispute.attachments,
      ...dispute.messages.flatMap((message) => message.attachments),
      ...dispute.internalNotes.flatMap((note) => note.attachments),
      ...(dispute.shopResponse?.attachments ?? []),
      ...(dispute.resolution?.documents ?? []),
      ...(dispute.resolution?.completionDocuments ?? []),
      ...(dispute.reinspections ?? []).flatMap((entry) => entry.attachments),
      ...(dispute.reworkProgress ?? []).flatMap((entry) => entry.attachments),
      ...(dispute.reworkCompletions ?? []).flatMap((entry) => entry.attachments),
      ...(dispute.verificationHistory ?? []).flatMap((entry) => entry.attachments),
    ];
    return attachments.find(
      (attachment) => attachment.fileId?.toString() === fileId,
    );
  }

  private validateAttachmentSignature(
    mimeType: DisputeAttachment['mimeType'],
    bytes: Buffer,
    name: string,
  ) {
    const valid =
      (mimeType === 'image/jpeg' &&
        bytes.length > 2 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[bytes.length - 2] === 0xff &&
        bytes[bytes.length - 1] === 0xd9) ||
      (mimeType === 'image/png' &&
        bytes.length > 8 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mimeType === 'image/webp' &&
        bytes.length > 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP') ||
      (mimeType === 'application/pdf' &&
        bytes.length > 4 &&
        bytes.toString('ascii', 0, 5) === '%PDF-');
    if (!valid) {
      throw new BadRequestException(
        `Attachment "${name}" does not match its declared file type.`,
      );
    }
  }

  private activeIssueKey(
    repairRequestId: Types.ObjectId,
    category: string,
    subject: string,
  ) {
    return `${repairRequestId.toString()}:${category}:${this.normalizeSubject(subject)}`;
  }

  private normalizeSubject(subject: string) {
    return subject.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private reference(id: Types.ObjectId, date: Date) {
    const day = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `PRX-DSP-${day}-${id.toString().slice(-8).toUpperCase()}`;
  }

  private objectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new NotFoundException('Record not found');
    }
    return new Types.ObjectId(value);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
