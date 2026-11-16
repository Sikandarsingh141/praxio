import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { isObjectIdOrHexString, Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatConversation } from '../chat/schemas/chat.schema';
import {
  RepairQuotation,
  RepairRequest,
} from '../customer/repair-request.schema';
import { User } from '../users/schemas/user.schema';
import {
  AssignTechnicianDto,
  CreateTechnicianDto,
  UpdateTechnicianDto,
  UpdateTechnicianStatusDto,
} from './dto/technician.dto';

const TERMINAL_STATUSES = [
  'repair_completed',
  'ready_for_pickup',
  'picked_up',
  'completed',
] as const;
const ACTIVE_STATUSES = [
  'confirmed',
  'inspection_pending',
  'inspection_in_progress',
  'awaiting_customer_approval',
  'inspection_approved',
  'in_progress',
  'on_hold',
] as const;

@Injectable()
export class TechniciansService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(RepairQuotation.name)
    private readonly quotations: Model<RepairQuotation>,
    @InjectModel(ChatConversation.name)
    private readonly conversations: Model<ChatConversation>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    shopId: string,
    query: { search?: string; status?: string; skill?: string } = {},
  ) {
    const shopObjectId = this.objectId(shopId, 'Shop account was not found');
    const filter: Record<string, unknown> = {
      accountType: 'technician',
      'technicianDetails.shopId': shopObjectId,
    };
    if (query.status === 'active' || query.status === 'inactive') {
      filter.accountLifecycleStatus = query.status;
    }
    if (query.skill?.trim()) {
      filter['technicianDetails.skills'] = query.skill.trim();
    }
    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expression = new RegExp(escaped, 'i');
      filter.$or = [
        { firstName: expression },
        { lastName: expression },
        { email: expression },
        { 'technicianDetails.employeeId': expression },
        { 'technicianDetails.skills': expression },
        { 'technicianDetails.specialization': expression },
      ];
    }
    const technicians = await this.users
      .find(filter)
      .select(
        'firstName lastName email countryCode mobileNumber profileImageData accountLifecycleStatus technicianDetails createdAt',
      )
      .sort({ 'technicianDetails.employeeId': 1 })
      .limit(500)
      .lean()
      .exec();
    const workloads = await this.getWorkloadCounts(
      shopObjectId,
      technicians.map((technician) => technician._id),
    );
    const mapped = technicians.map((technician) =>
      this.toTechnician(
        technician,
        workloads.get(technician._id.toString()) ?? 0,
      ),
    );
    const summary = {
      total: technicians.length,
      available: mapped.filter(
        (technician) => technician.availability === 'available',
      ).length,
      busy: mapped.filter((technician) => technician.availability === 'busy')
        .length,
      onLeave: mapped.filter(
        (technician) => technician.availability === 'on_leave',
      ).length,
      inactive: mapped.filter(
        (technician) => technician.availability === 'inactive',
      ).length,
    };
    return { technicians: mapped, summary };
  }

  async create(shopId: string, input: CreateTechnicianDto) {
    const shopObjectId = await this.requireShop(shopId);
    const names = this.validateNames(input.firstName, input.lastName);
    const skills = this.normalizeSkills(input.skills);
    try {
      const technician = await this.users.create({
        ...names,
        email: input.email.trim().toLowerCase(),
        countryCode: input.countryCode,
        mobileNumber: input.mobileNumber,
        passwordHash: await bcrypt.hash(input.password, 12),
        accountType: 'technician',
        accountStatus: 'active',
        accountLifecycleStatus:
          input.status === 'inactive' ? 'inactive' : 'active',
        ...(input.profileImageData
          ? { profileImageData: input.profileImageData }
          : {}),
        technicianDetails: {
          shopId: shopObjectId,
          employeeId: input.employeeId.trim().toUpperCase(),
          skills,
          specialization: input.specialization.trim(),
          experienceYears: input.experienceYears,
          employmentType: input.employmentType,
          joiningDate: new Date(input.joiningDate),
          availabilityPreference: input.availabilityPreference ?? 'available',
          activityHistory: [
            {
              actorId: shopObjectId,
              action: 'created',
              at: new Date(),
            },
          ],
        },
      });
      return this.getTechnician(shopId, technician._id.toString());
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async update(
    shopId: string,
    technicianId: string,
    input: UpdateTechnicianDto,
  ) {
    const technician = await this.findTechnician(shopId, technicianId);
    const update: Record<string, unknown> = {};
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const names = this.validateNames(
        input.firstName ?? technician.firstName ?? '',
        input.lastName ?? technician.lastName ?? '',
      );
      update.firstName = names.firstName;
      update.lastName = names.lastName;
    }
    if (input.email !== undefined)
      update.email = input.email.trim().toLowerCase();
    if (input.countryCode !== undefined) update.countryCode = input.countryCode;
    if (input.mobileNumber !== undefined)
      update.mobileNumber = input.mobileNumber;
    if (input.password)
      update.passwordHash = await bcrypt.hash(input.password, 12);
    if (input.profileImageData !== undefined)
      update.profileImageData = input.profileImageData;
    if (input.status !== undefined) {
      update.accountLifecycleStatus =
        input.status === 'active' ? 'active' : 'inactive';
    }
    if (input.employeeId !== undefined) {
      update['technicianDetails.employeeId'] = input.employeeId
        .trim()
        .toUpperCase();
    }
    if (input.skills !== undefined) {
      update['technicianDetails.skills'] = this.normalizeSkills(input.skills);
    }
    if (input.specialization !== undefined) {
      update['technicianDetails.specialization'] = input.specialization.trim();
    }
    if (input.experienceYears !== undefined) {
      update['technicianDetails.experienceYears'] = input.experienceYears;
    }
    if (input.employmentType !== undefined) {
      update['technicianDetails.employmentType'] = input.employmentType;
    }
    if (input.joiningDate !== undefined) {
      update['technicianDetails.joiningDate'] = new Date(input.joiningDate);
    }
    if (input.availabilityPreference !== undefined) {
      update['technicianDetails.availabilityPreference'] =
        input.availabilityPreference;
    }
    if (input.status !== undefined) {
      update['technicianDetails.activityHistory'] = {
        $each: [
          {
            actorId: new Types.ObjectId(shopId),
            action: input.status === 'active' ? 'activated' : 'deactivated',
            at: new Date(),
          },
        ],
        $position: 0,
        $slice: 100,
      };
    } else if (Object.keys(update).length) {
      update['technicianDetails.activityHistory'] = {
        $each: [
          {
            actorId: new Types.ObjectId(shopId),
            action: 'updated',
            at: new Date(),
          },
        ],
        $position: 0,
        $slice: 100,
      };
    }
    try {
      await this.users
        .updateOne(
          {
            _id: technician._id,
            accountType: 'technician',
            'technicianDetails.shopId': technician.technicianDetails!.shopId,
          },
          {
            $set: Object.fromEntries(
              Object.entries(update).filter(
                ([key]) => key !== 'technicianDetails.activityHistory',
              ),
            ),
            ...(update['technicianDetails.activityHistory']
              ? {
                  $push: {
                    'technicianDetails.activityHistory':
                      update['technicianDetails.activityHistory'],
                  },
                }
              : {}),
          },
          { runValidators: true },
        )
        .exec();
      return this.getTechnician(shopId, technicianId);
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async updateStatus(
    shopId: string,
    technicianId: string,
    input: UpdateTechnicianStatusDto,
  ) {
    return this.update(shopId, technicianId, input);
  }

  async getTechnician(shopId: string, technicianId: string) {
    const technician = await this.findTechnician(shopId, technicianId);
    const workloads = await this.getWorkloadCounts(
      technician.technicianDetails!.shopId,
      [technician._id],
    );
    const view = this.toTechnician(
      technician,
      workloads.get(technician._id.toString()) ?? 0,
    );
    const requests = await this.repairRequests
      .find({
        shopIds: technician.technicianDetails!.shopId,
        $or: [
          { 'repairJob.activeAssignment.technicianId': technician._id },
          { 'repairJob.assignmentHistory.technicianId': technician._id },
          {
            'repairJob.assignmentHistory.previousTechnicianId': technician._id,
          },
        ],
      })
      .select('_id appliance brand model repairJob createdAt')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    const relatedUserIds = new Set<string>();
    requests.forEach((request) => {
      request.repairJob?.assignmentHistory?.forEach((event) => {
        relatedUserIds.add(event.actorId.toString());
        if (event.technicianId)
          relatedUserIds.add(event.technicianId.toString());
        if (event.previousTechnicianId) {
          relatedUserIds.add(event.previousTechnicianId.toString());
        }
      });
    });
    technician.technicianDetails?.activityHistory?.forEach((activity) => {
      relatedUserIds.add(activity.actorId.toString());
    });
    const relatedUsers = relatedUserIds.size
      ? await this.users
          .find({
            _id: {
              $in: [...relatedUserIds].map((id) => new Types.ObjectId(id)),
            },
          })
          .select('firstName lastName fullName')
          .lean()
          .exec()
      : [];
    const names = new Map(
      relatedUsers.map((user) => [
        user._id.toString(),
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          user.fullName ||
          'Shop owner',
      ]),
    );
    const jobs = requests.map((request) => ({
      id: request._id.toString(),
      appliance: request.appliance,
      brand: request.brand ?? '',
      model: request.model ?? '',
      status: request.repairJob?.status ?? 'confirmed',
      assignedAt:
        request.repairJob?.activeAssignment?.technicianId.toString() ===
        technicianId
          ? request.repairJob.activeAssignment.assignedAt
          : (request.repairJob?.assignmentHistory
              ?.filter(
                (event) => event.technicianId?.toString() === technicianId,
              )
              .at(-1)?.at ?? request.createdAt),
      completedAt:
        request.repairJob?.repairCompletedAt ??
        request.repairJob?.completedAt ??
        null,
    }));
    const history = requests
      .flatMap((request) =>
        (request.repairJob?.assignmentHistory ?? [])
          .filter(
            (event) =>
              event.technicianId?.toString() === technicianId ||
              event.previousTechnicianId?.toString() === technicianId ||
              event.actorId.toString() === technicianId,
          )
          .map((event) => ({
            requestId: request._id.toString(),
            appliance: request.appliance,
            action: event.action,
            reason: event.reason ?? '',
            at: event.at,
            actor: names.get(event.actorId.toString()) ?? 'Shop owner',
          })),
      )
      .sort(
        (left, right) =>
          new Date(right.at).getTime() - new Date(left.at).getTime(),
      );
    const completed = jobs.filter((job) =>
      [
        'repair_completed',
        'ready_for_pickup',
        'picked_up',
        'completed',
      ].includes(job.status),
    );
    const completionDurations = completed
      .filter(
        (job): job is typeof job & { completedAt: Date } =>
          job.completedAt !== null,
      )
      .map((job) =>
        Math.max(
          0,
          new Date(job.completedAt).getTime() -
            new Date(job.assignedAt).getTime(),
        ),
      );

    return {
      ...view,
      contact: {
        phone:
          `${technician.countryCode ?? ''} ${technician.mobileNumber ?? ''}`.trim(),
      },
      jobs,
      performance: {
        totalJobs: jobs.length,
        completedJobs: completed.length,
        inProgressJobs: jobs.filter((job) =>
          ['in_progress', 'inspection_in_progress'].includes(job.status),
        ).length,
        reassignedJobs: requests.filter((request) =>
          request.repairJob?.assignmentHistory?.some(
            (event) => event.previousTechnicianId?.toString() === technicianId,
          ),
        ).length,
        averageCompletionTimeHours:
          completionDurations.length > 0
            ? Math.round(
                completionDurations.reduce(
                  (total, duration) => total + duration,
                  0,
                ) /
                  completionDurations.length /
                  3_600_000,
              )
            : null,
      },
      history,
      profileActivity: (
        technician.technicianDetails?.activityHistory ?? []
      ).map((activity) => ({
        action: activity.action,
        at: activity.at,
        actor: names.get(activity.actorId.toString()) ?? 'Shop owner',
      })),
    };
  }

  async setAssignment(
    shopId: string,
    requestId: string,
    actorId: string,
    input: AssignTechnicianDto,
  ) {
    const shopObjectId = await this.requireShop(shopId);
    const actorObjectId = this.objectId(
      actorId,
      'Authenticated shop account was not found',
    );
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shopObjectId })
      .select('acceptedQuotationId repairJob appliance')
      .lean()
      .exec();
    if (
      !request?.acceptedQuotationId ||
      !(await this.quotations.exists({
        _id: request.acceptedQuotationId,
        shopId: shopObjectId,
        status: 'accepted',
      }))
    ) {
      throw new NotFoundException(
        'Accepted repair job was not found for this shop',
      );
    }
    let targetId: Types.ObjectId;
    if (input.technicianId) {
      const target = await this.findTechnician(shopId, input.technicianId);
      if (target.accountLifecycleStatus !== 'active') {
        throw new ConflictException('Inactive technicians cannot be assigned.');
      }
      if (target.technicianDetails?.availabilityPreference === 'on_leave') {
        throw new ConflictException('Technicians on leave cannot be assigned.');
      }
      targetId = target._id;
    } else {
      targetId = await this.requireShop(shopId);
    }
    const existingId = request.repairJob?.activeAssignment?.technicianId;
    if (existingId?.toString() === targetId.toString()) {
      throw new ConflictException(
        'This technician is already assigned to the repair.',
      );
    }
    const action = existingId ? 'reassigned' : 'assigned';
    if (action === 'reassigned' && !input.reason?.trim()) {
      throw new BadRequestException(
        'Enter a reason when reassigning a technician.',
      );
    }
    const now = new Date();
    const activeAssignment = {
      shopId: shopObjectId,
      technicianId: targetId,
      assignedById: actorObjectId,
      assignedAt: now,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };
    const filter: Record<string, unknown> = {
      _id: request._id,
      shopIds: shopObjectId,
      acceptedQuotationId: request.acceptedQuotationId,
      'repairJob.status': { $nin: [...TERMINAL_STATUSES] },
      'repairJob.activeAssignment.technicianId': existingId
        ? existingId
        : { $exists: false },
    };
    const updated = await this.repairRequests
      .findOneAndUpdate(
        filter,
        {
          $set: { 'repairJob.activeAssignment': activeAssignment },
          $push: {
            'repairJob.assignmentHistory': {
              shopId: shopObjectId,
              ...(existingId ? { previousTechnicianId: existingId } : {}),
              technicianId: targetId,
              actorId: actorObjectId,
              action,
              ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'This repair can no longer be assigned. Refresh and try again.',
      );
    }
    const recipients = [targetId, ...(existingId ? [existingId] : [])].filter(
      (recipient) => recipient.toString() !== shopObjectId.toString(),
    );
    if (recipients.length) {
      await this.notifications.notifyUsers(recipients, {
        title: action === 'assigned' ? 'Repair Assigned' : 'Repair Reassigned',
        message:
          action === 'assigned'
            ? `You have been assigned to ${request.appliance}.`
            : `The assignment for ${request.appliance} has changed.${input.reason?.trim() ? ` Reason: ${input.reason.trim()}` : ''}`,
        type:
          action === 'assigned'
            ? 'technician_assignment'
            : 'technician_reassignment',
        relatedEntityId: updated._id,
        relatedEntityType: 'repair_request',
        link: '/technician',
      });
    }
    const workloads = await this.getWorkloadCounts(shopObjectId, [targetId]);
    return {
      assignment: updated.repairJob?.activeAssignment,
      warning:
        input.technicianId && (workloads.get(targetId.toString()) ?? 0) > 1
          ? 'This technician already has active work assigned.'
          : null,
    };
  }

  async unassign(
    shopId: string,
    requestId: string,
    actorId: string,
    reason: string,
  ) {
    const shopObjectId = await this.requireShop(shopId);
    const actorObjectId = this.objectId(
      actorId,
      'Authenticated shop account was not found',
    );
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({ _id: requestId, shopIds: shopObjectId })
      .select('acceptedQuotationId repairJob appliance')
      .lean()
      .exec();
    const active = request?.repairJob?.activeAssignment;
    if (!request?.acceptedQuotationId || !active) {
      throw new NotFoundException('Active technician assignment was not found');
    }
    if (!reason.trim()) {
      throw new BadRequestException(
        'Enter a reason to unassign this technician.',
      );
    }
    const updated = await this.repairRequests
      .findOneAndUpdate(
        {
          _id: request._id,
          shopIds: shopObjectId,
          'repairJob.activeAssignment.technicianId': active.technicianId,
        },
        {
          $unset: { 'repairJob.activeAssignment': 1 },
          $push: {
            'repairJob.assignmentHistory': {
              shopId: shopObjectId,
              previousTechnicianId: active.technicianId,
              actorId: actorObjectId,
              action: 'unassigned',
              reason: reason.trim(),
              at: new Date(),
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'This assignment has changed. Refresh and try again.',
      );
    }
    if (active.technicianId.toString() !== shopObjectId.toString()) {
      await this.notifications.notifyUsers([active.technicianId], {
        title: 'Repair Assignment Removed',
        message: `You are no longer assigned to ${request.appliance}. Reason: ${reason.trim()}`,
        type: 'technician_unassignment',
        relatedEntityId: updated._id,
        relatedEntityType: 'repair_request',
        link: '/technician',
      });
    }
    return { unassigned: true };
  }

  async listAssignments(shopId: string) {
    const shopObjectId = await this.requireShop(shopId);
    const requests = await this.repairRequests
      .find({
        shopIds: shopObjectId,
        'repairJob.activeAssignment.shopId': shopObjectId,
        'repairJob.status': { $nin: [...TERMINAL_STATUSES] },
      })
      .select('_id appliance brand model repairJob updatedAt customerId')
      .sort({ 'repairJob.activeAssignment.assignedAt': -1 })
      .limit(500)
      .lean()
      .exec();
    const technicianIds = [
      ...new Set(
        requests
          .map((request) =>
            request.repairJob?.activeAssignment?.technicianId.toString(),
          )
          .filter((id): id is string => !!id),
      ),
    ];
    const customerIds = [
      ...new Set(requests.map((request) => request.customerId.toString())),
    ];
    const [technicians, customers] = await Promise.all([
      this.users
        .find({
          _id: { $in: technicianIds.map((id) => new Types.ObjectId(id)) },
        })
        .select(
          'firstName lastName profileImageData technicianDetails accountType',
        )
        .lean()
        .exec(),
      this.users
        .find({ _id: { $in: customerIds.map((id) => new Types.ObjectId(id)) } })
        .select('firstName lastName fullName')
        .lean()
        .exec(),
    ]);
    const techById = new Map(
      technicians.map((user) => [user._id.toString(), user]),
    );
    const customerById = new Map(
      customers.map((user) => [user._id.toString(), user]),
    );
    return requests.map((request) => {
      const assignment = request.repairJob!.activeAssignment!;
      const technician = techById.get(assignment.technicianId.toString());
      const customer = customerById.get(request.customerId.toString());
      const isOwner =
        assignment.technicianId.toString() === shopObjectId.toString();
      return {
        requestId: request._id.toString(),
        appliance: request.appliance,
        brand: request.brand ?? '',
        model: request.model ?? '',
        repairStatus: request.repairJob!.status,
        customer:
          [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
          customer?.fullName ||
          'Customer',
        assignment,
        technician: isOwner
          ? {
              id: shopObjectId.toString(),
              name: 'You',
              availability: 'available',
              workload: 0,
            }
          : technician
            ? this.toTechnician(technician, 0)
            : null,
      };
    });
  }

  async technicianJobs(
    technicianId: string,
    filter:
      | 'all'
      | 'pending'
      | 'active'
      | 'today'
      | 'in_progress'
      | 'completed'
      | 'on_hold'
      | 'history' = 'all',
  ) {
    const technician = await this.findTechnicianForSelf(technicianId);
    const technicianIdFilter = {
      'repairJob.activeAssignment.technicianId': technician._id,
    };
    const historyFilter = {
      $or: [
        technicianIdFilter,
        { 'repairJob.assignmentHistory.technicianId': technician._id },
        { 'repairJob.assignmentHistory.previousTechnicianId': technician._id },
      ],
    };
    const requests = await this.repairRequests
      .find({
        shopIds: technician.technicianDetails!.shopId,
        ...(filter === 'history' ? historyFilter : technicianIdFilter),
      })
      .select(
        '_id appliance brand model description photos repairJob createdAt customerId preferredServiceDate acceptedQuotationId',
      )
      .sort({ 'repairJob.activeAssignment.assignedAt': -1 })
      .lean()
      .exec();
    const customerIds = [
      ...new Set(requests.map((request) => request.customerId.toString())),
    ];
    const customers = customerIds.length
      ? await this.users
          .find({
            _id: { $in: customerIds.map((id) => new Types.ObjectId(id)) },
          })
          .select('firstName lastName fullName mobileNumber countryCode location')
          .lean()
          .exec()
      : [];
    const customerById = new Map(
      customers.map((user) => [user._id.toString(), user]),
    );

    const shopUser = await this.users
      .findById(technician.technicianDetails!.shopId)
      .select('shopDetails mobileNumber countryCode')
      .lean()
      .exec();
    const shopName = shopUser?.shopDetails?.shopName || 'Repair Shop';

    const quotationIds = requests
      .map((r) => r.acceptedQuotationId)
      .filter(Boolean);
    const quotations = quotationIds.length
      ? await this.quotations
          .find({ _id: { $in: quotationIds } })
          .select('amount currency')
          .lean()
          .exec()
      : [];
    const quotationById = new Map(
      quotations.map((q) => [q._id.toString(), q]),
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const jobs = requests.map((request) => {
      const cust = customerById.get(request.customerId.toString());
      const quot = request.acceptedQuotationId
        ? quotationById.get(request.acceptedQuotationId.toString())
        : null;
      return {
        id: request._id.toString(),
        appliance: request.appliance,
        brand: request.brand ?? '',
        model: request.model ?? '',
        description: request.description ?? '',
        photo: request.photos?.[0]?.data ?? null,
        status: request.repairJob?.status ?? 'confirmed',
        assignedAt:
          request.repairJob?.activeAssignment?.assignedAt ?? request.createdAt,
        scheduledDate: request.preferredServiceDate ?? null,
        completedAt: request.repairJob?.repairCompletedAt ?? null,
        customer:
          [cust?.firstName, cust?.lastName].filter(Boolean).join(' ') ||
          cust?.fullName ||
          'Customer',
        phone: cust?.mobileNumber
          ? `${cust.countryCode ?? ''} ${cust.mobileNumber}`.trim()
          : null,
        address: cust?.location
          ? `${cust.location.latitude?.toFixed(4)}, ${cust.location.longitude?.toFixed(4)}`
          : null,
        shopName,
        quotationAmount: quot?.amount ?? null,
        quotationCurrency: quot?.currency ?? 'INR',
      };
    });

    const summary = {
      assigned: jobs.length,
      pending: jobs.filter((job) =>
        ['confirmed', 'inspection_pending', 'inspection_approved'].includes(job.status),
      ).length,
      active: jobs.filter((job) =>
        ['in_progress', 'inspection_in_progress', 'on_hold'].includes(job.status),
      ).length,
      inProgress: jobs.filter((job) =>
        ['in_progress', 'inspection_in_progress'].includes(job.status),
      ).length,
      completed: jobs.filter((job) =>
        [
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
          'completed',
        ].includes(job.status),
      ).length,
      onHold: jobs.filter((job) => job.status === 'on_hold').length,
      today: jobs.filter((job) => {
        if (!job.scheduledDate) return false;
        const scheduledAt = new Date(job.scheduledDate).getTime();
        return (
          scheduledAt >= today.getTime() && scheduledAt < tomorrow.getTime()
        );
      }).length,
    };

    const filteredJobs = jobs.filter((job) => {
      if (filter === 'pending') {
        return ['confirmed', 'inspection_pending', 'inspection_approved'].includes(job.status);
      }
      if (filter === 'active') {
        return ['in_progress', 'inspection_in_progress', 'on_hold'].includes(job.status);
      }
      if (filter === 'today') {
        if (!job.scheduledDate) return false;
        const scheduledAt = new Date(job.scheduledDate).getTime();
        return (
          scheduledAt >= today.getTime() && scheduledAt < tomorrow.getTime()
        );
      }
      if (filter === 'in_progress')
        return ['in_progress', 'inspection_in_progress'].includes(job.status);
      if (filter === 'completed')
        return [
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
          'completed',
        ].includes(job.status);
      if (filter === 'on_hold') return job.status === 'on_hold';
      return true;
    });

    return { jobs: filteredJobs, summary };
  }

  async technicianDashboard(technicianId: string) {
    const technician = await this.findTechnicianForSelf(technicianId);
    const shopObjectId = technician.technicianDetails!.shopId;
    const technicianIdFilter = {
      'repairJob.activeAssignment.technicianId': technician._id,
      shopIds: shopObjectId,
    };

    const requests = await this.repairRequests
      .find(technicianIdFilter)
      .select(
        '_id appliance brand model repairJob createdAt customerId preferredServiceDate description photos acceptedQuotationId',
      )
      .sort({ 'repairJob.activeAssignment.assignedAt': -1 })
      .lean()
      .exec();

    const customerIds = [
      ...new Set(requests.map((r) => r.customerId.toString())),
    ];
    const customers = customerIds.length
      ? await this.users
          .find({ _id: { $in: customerIds.map((id) => new Types.ObjectId(id)) } })
          .select('firstName lastName fullName mobileNumber countryCode location')
          .lean()
          .exec()
      : [];
    const customerById = new Map(
      customers.map((c) => [c._id.toString(), c]),
    );

    const shopUser = await this.users
      .findById(shopObjectId)
      .select('shopDetails mobileNumber countryCode email')
      .lean()
      .exec();
    const shopName = shopUser?.shopDetails?.shopName || 'Repair Shop';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const jobs = requests.map((request) => {
      const cust = customerById.get(request.customerId.toString());
      return {
        id: request._id.toString(),
        appliance: request.appliance,
        brand: request.brand ?? '',
        model: request.model ?? '',
        description: request.description ?? '',
        photo: request.photos?.[0]?.data ?? null,
        status: request.repairJob?.status ?? 'confirmed',
        assignedAt:
          request.repairJob?.activeAssignment?.assignedAt ?? request.createdAt,
        scheduledDate: request.preferredServiceDate ?? null,
        completedAt: request.repairJob?.repairCompletedAt ?? null,
        customer:
          [cust?.firstName, cust?.lastName].filter(Boolean).join(' ') ||
          cust?.fullName ||
          'Customer',
        phone: cust?.mobileNumber
          ? `${cust.countryCode ?? ''} ${cust.mobileNumber}`.trim()
          : null,
        address: cust?.location
          ? `${cust.location.latitude?.toFixed(4)}, ${cust.location.longitude?.toFixed(4)}`
          : null,
        shopName,
      };
    });

    const totalAssigned = jobs.length;
    const pendingJobs = jobs.filter((job) =>
      ['confirmed', 'inspection_pending', 'inspection_approved'].includes(job.status),
    );
    const activeJobs = jobs.filter((job) =>
      ['in_progress', 'inspection_in_progress', 'on_hold'].includes(job.status),
    );
    const completedJobs = jobs.filter((job) =>
      ['repair_completed', 'ready_for_pickup', 'picked_up', 'completed'].includes(job.status),
    );
    const todayJobs = jobs.filter((job) => {
      if (!job.scheduledDate) return false;
      const scheduledAt = new Date(job.scheduledDate).getTime();
      return scheduledAt >= today.getTime() && scheduledAt < tomorrow.getTime();
    });

    // Currently Active Job: job in in_progress or inspection_in_progress
    const currentlyActiveJob =
      jobs.find((job) => job.status === 'in_progress' || job.status === 'inspection_in_progress') ||
      activeJobs[0] ||
      null;

    const todaySchedule = todayJobs.slice(0, 5);
    const recentlyAssigned = jobs.slice(0, 6);
    const upcomingJobs = jobs
      .filter((job) => {
        if (!job.scheduledDate) return false;
        return new Date(job.scheduledDate).getTime() >= tomorrow.getTime();
      })
      .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())
      .slice(0, 5);

    // Recent notifications
    let recentNotifications: any[] = [];
    try {
      const notifs = await this.notifications.getForUser(technicianId);
      recentNotifications = (notifs || []).slice(0, 6);
    } catch {
      recentNotifications = [];
    }

    // Recent messages
    let recentMessages: any[] = [];
    try {
      const convs = await this.conversations
        .find({ participants: technician._id })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .limit(6)
        .lean()
        .exec();

      if (convs.length) {
        const reqIds = convs.map((c) => c.repairRequestId);
        const convRequests = await this.repairRequests
          .find({ _id: { $in: reqIds } })
          .select('_id appliance customerId')
          .lean()
          .exec();
        const convReqMap = new Map(convRequests.map((r) => [r._id.toString(), r]));

        recentMessages = convs.map((conv) => {
          const req = convReqMap.get(conv.repairRequestId.toString());
          const cust = req ? customerById.get(req.customerId.toString()) : null;
          return {
            id: conv._id.toString(),
            requestId: conv.repairRequestId.toString(),
            appliance: req?.appliance || 'Repair Request',
            customerName:
              [cust?.firstName, cust?.lastName].filter(Boolean).join(' ') ||
              cust?.fullName ||
              'Customer',
            lastMessage: conv.lastMessage || 'New message in conversation',
            lastMessageAt: conv.lastMessageAt || conv.updatedAt,
            unreadCount: conv.technicianUnreadCount || 0,
          };
        });
      }
    } catch {
      recentMessages = [];
    }

    const recentActivity = [
      ...requests.flatMap((r) => [
        ...(r.repairJob?.history || []).map((h) => ({
          type: h.action === 'repair_started' ? 'job_started' : 'status_update',
          title: h.action === 'repair_started' ? 'Job started' : h.action.replace(/_/g, ' '),
          subtitle: `${r.appliance} (#${r._id.toString().slice(-8).toUpperCase()})`,
          at: h.at || r.createdAt,
        })),
        ...(r.repairJob?.assignmentHistory || [])
          .filter((a) => a.technicianId?.toString() === technicianId)
          .map((a) => ({
            type: 'job_assigned',
            title: 'Job assigned',
            subtitle: `${r.appliance} (#${r._id.toString().slice(-8).toUpperCase()})`,
            at: a.at || r.createdAt,
          })),
      ]),
      ...recentMessages.map((m) => ({
        type: 'new_message',
        title: 'New message',
        subtitle: m.customerName,
        at: m.lastMessageAt,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    return {
      kpis: {
        totalAssigned,
        pendingJobs: pendingJobs.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        todayJobs: todayJobs.length,
      },
      currentlyActiveJob,
      todaySchedule,
      recentlyAssigned,
      upcomingJobs,
      recentMessages,
      recentNotifications,
      recentActivity,
      technician: this.toTechnician(technician, activeJobs.length),
    };
  }

  async technicianJobDetails(technicianId: string, requestId: string) {
    const technician = await this.findTechnicianForSelf(technicianId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Assigned repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({
        _id: requestId,
        shopIds: technician.technicianDetails!.shopId,
        $or: [
          {
            'repairJob.activeAssignment.shopId':
              technician.technicianDetails!.shopId,
            'repairJob.activeAssignment.technicianId': technician._id,
          },
          { 'repairJob.assignmentHistory.technicianId': technician._id },
          {
            'repairJob.assignmentHistory.previousTechnicianId': technician._id,
          },
        ],
      })
      .lean()
      .exec();
    if (!request) {
      throw new NotFoundException('Assigned repair request was not found');
    }

    const customer = await this.users
      .findById(request.customerId)
      .select('firstName lastName fullName email countryCode mobileNumber location')
      .lean()
      .exec();

    const shop = await this.users
      .findById(technician.technicianDetails!.shopId)
      .select('firstName lastName fullName email mobileNumber countryCode shopDetails')
      .lean()
      .exec();

    const quotation = request.acceptedQuotationId
      ? await this.quotations.findById(request.acceptedQuotationId).lean().exec()
      : null;

    const latitude = request.customerLatitude ?? customer?.location?.latitude;
    const longitude =
      request.customerLongitude ?? customer?.location?.longitude;

    // Build timeline from history
    const historyEvents = request.repairJob?.history || [];
    const actorIds = [...new Set(historyEvents.map((h) => h.actorId?.toString()).filter(Boolean))];
    const actors = actorIds.length
      ? await this.users
          .find({ _id: { $in: actorIds.map((id) => new Types.ObjectId(id)) } })
          .select('firstName lastName fullName shopDetails accountType')
          .lean()
          .exec()
      : [];
    const actorById = new Map(actors.map((a) => [a._id.toString(), a]));

    const timeline = historyEvents.map((event) => {
      const actor = event.actorId ? actorById.get(event.actorId.toString()) : null;
      let actorName = 'Fixora System';
      let actorRole = 'system';
      if (actor) {
        actorRole = actor.accountType;
        if (actor.accountType === 'shop') {
          actorName = actor.shopDetails?.shopName || 'Shop Admin';
        } else if (actor.accountType === 'technician') {
          actorName = [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.fullName || 'Technician';
        } else {
          actorName = [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.fullName || 'Customer';
        }
      }
      return {
        action: event.action,
        notes: event.notes || '',
        at: event.at,
        actorName,
        actorRole,
      };
    });

    return {
      id: request._id.toString(),
      shopId: technician.technicianDetails!.shopId.toString(),
      appliance: request.appliance,
      brand: request.brand ?? '',
      model: request.model ?? '',
      description: request.description,
      photos: request.photos ?? [],
      status: request.repairJob?.status ?? 'confirmed',
      assignedAt:
        request.repairJob?.activeAssignment?.assignedAt ?? request.createdAt,
      scheduledDate: request.preferredServiceDate ?? null,
      serviceType: request.serviceType ?? null,
      customer: {
        name:
          [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
          customer?.fullName ||
          'Customer',
        phone: customer?.mobileNumber
          ? `${customer.countryCode ?? ''} ${customer.mobileNumber}`.trim()
          : null,
        email: customer?.email ?? null,
        location:
          typeof latitude === 'number' && typeof longitude === 'number'
            ? { latitude, longitude }
            : null,
      },
      shop: {
        id: shop?._id.toString(),
        name: shop?.shopDetails?.shopName || 'Repair Shop',
        phone: shop?.mobileNumber
          ? `${shop.countryCode ?? ''} ${shop.mobileNumber}`.trim()
          : null,
        email: shop?.email ?? null,
        address: shop?.shopDetails?.address ?? null,
        city: shop?.shopDetails?.city ?? null,
      },
      quotation: quotation
        ? {
            id: quotation._id.toString(),
            amount: quotation.amount,
            currency: quotation.currency || 'INR',
            inspectionFee: quotation.inspectionCharge ?? 0,
            labourFee: quotation.labourCharge ?? 0,
            partsFee: quotation.partsCost ?? 0,
            notes: quotation.message || quotation.additionalNotes || '',
            proposedSolution: quotation.proposedSolution ?? '',
            warrantyInformation: quotation.warrantyInformation ?? '',
            estimatedDays: quotation.estimatedDays ?? null,
            approvedAt: quotation.updatedAt ?? null,
          }
        : null,
      assignment: {
        assignedAt: request.repairJob?.activeAssignment?.assignedAt ?? request.createdAt,
        note: request.repairJob?.activeAssignment?.note ?? '',
        technicianName: technician.firstName
          ? `${technician.firstName} ${technician.lastName}`.trim()
          : 'Technician',
      },
      repairJob: {
        status: request.repairJob?.status ?? 'confirmed',
        startedAt: request.repairJob?.startedAt ?? null,
        repairCompletedAt: request.repairJob?.repairCompletedAt ?? null,
        completionDescription: request.repairJob?.completionDescription ?? '',
        workPerformed: request.repairJob?.workPerformed ?? '',
        partsReplaced: request.repairJob?.partsReplaced ?? '',
        finalNotes: request.repairJob?.finalNotes ?? '',
        pickupInstructions: request.repairJob?.pickupInstructions ?? '',
      },
      timeline,
      phone: customer?.mobileNumber
        ? `${customer.countryCode ?? ''} ${customer.mobileNumber}`.trim()
        : null,
      location:
        typeof latitude === 'number' && typeof longitude === 'number'
          ? { latitude, longitude }
          : null,
    };
  }

  async updateProgress(
    technicianId: string,
    requestId: string,
    input: { notes?: string },
  ) {
    const technician = await this.findTechnicianForSelf(technicianId);
    if (!isObjectIdOrHexString(requestId)) {
      throw new NotFoundException('Assigned repair request was not found');
    }
    const request = await this.repairRequests
      .findOne({
        _id: requestId,
        shopIds: technician.technicianDetails!.shopId,
        'repairJob.activeAssignment.technicianId': technician._id,
      })
      .exec();
    if (!request) {
      throw new NotFoundException('Assigned repair request was not found');
    }
    const now = new Date();
    const noteText = input.notes?.trim() || 'Technician updated progress.';
    if (!request.repairJob) {
      throw new BadRequestException('Repair job not initialized');
    }
    if (!request.repairJob.history) {
      request.repairJob.history = [];
    }
    request.repairJob.history.push({
      actorId: technician._id,
      action: 'progress_note',
      notes: noteText,
      at: now,
    });
    if (input.notes?.trim()) {
      request.repairJob.finalNotes = (
        (request.repairJob.finalNotes ? request.repairJob.finalNotes + '\n' : '') +
        `[${now.toLocaleDateString()}] ${input.notes.trim()}`
      ).slice(0, 2000);
    }
    await request.save();

    // Notify shop
    await this.notifications.notifyUsers([technician.technicianDetails!.shopId], {
      title: 'Technician Progress Note',
      message: `${technician.firstName || 'Technician'} added a progress note on ${request.appliance}: ${noteText.slice(0, 100)}`,
      type: 'repair_started',
      relatedEntityId: request._id,
      relatedEntityType: 'repair_request',
      link: `/shop/repair-requests/${request._id.toString()}`,
    });

    return { success: true, notes: noteText, at: now };
  }

  async searchTechnicianActivity(technicianId: string, queryText?: string) {
    const query = (queryText || '').trim();
    if (!query) return [];

    const technician = await this.findTechnicianForSelf(technicianId);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'i');

    const requests = await this.repairRequests
      .find({
        shopIds: technician.technicianDetails!.shopId,
        'repairJob.activeAssignment.technicianId': technician._id,
        $or: [
          { appliance: expression },
          { brand: expression },
          { model: expression },
          { description: expression },
        ],
      })
      .select('_id appliance brand model repairJob')
      .limit(8)
      .lean()
      .exec();

    return requests.map((req) => ({
      id: req._id.toString(),
      title: req.appliance,
      details: `${req.brand || ''} ${req.model || ''}`.trim() || 'Repair Job',
      status: req.repairJob?.status || 'confirmed',
      route: ['/technician/jobs'],
      queryParams: { jobId: req._id.toString() },
    }));
  }

  async updateOwnAvailability(
    technicianId: string,
    availabilityPreference: 'available' | 'on_leave',
  ) {
    const technician = await this.findTechnicianForSelf(technicianId);
    return this.update(
      technician.technicianDetails!.shopId.toString(),
      technicianId,
      {
        availabilityPreference,
      },
    );
  }

  async technicianShopId(technicianId: string): Promise<string> {
    const technician = await this.findTechnicianForSelf(technicianId);
    return technician.technicianDetails!.shopId.toString();
  }

  private async findTechnician(shopId: string, technicianId: string) {
    if (!isObjectIdOrHexString(technicianId)) {
      throw new NotFoundException('Technician was not found');
    }
    const shopObjectId = this.objectId(shopId, 'Shop account was not found');
    const technician = await this.users
      .findOne({
        _id: technicianId,
        accountType: 'technician',
        'technicianDetails.shopId': shopObjectId,
      })
      .select('+passwordHash')
      .exec();
    if (!technician) throw new NotFoundException('Technician was not found');
    return technician;
  }

  private async findTechnicianForSelf(technicianId: string) {
    const technician = await this.users
      .findOne({
        _id: technicianId,
        accountType: 'technician',
        accountLifecycleStatus: 'active',
      })
      .exec();
    if (!technician || !technician.technicianDetails) {
      throw new ForbiddenException(
        'Technician portal access is not available.',
      );
    }
    return technician;
  }

  private async requireShop(shopId: string) {
    const shop = await this.users
      .findOne({ _id: shopId, accountType: 'shop' })
      .exec();
    if (!shop) throw new ForbiddenException('Shop access is not available.');
    return shop._id;
  }

  private async getWorkloadCounts(
    shopId: Types.ObjectId,
    technicianIds: Types.ObjectId[],
  ) {
    if (!technicianIds.length) return new Map<string, number>();
    const requests = await this.repairRequests
      .find({
        'repairJob.activeAssignment.shopId': shopId,
        'repairJob.activeAssignment.technicianId': { $in: technicianIds },
        'repairJob.status': { $in: [...ACTIVE_STATUSES] },
      })
      .select('repairJob.activeAssignment.technicianId')
      .lean()
      .exec();
    const counts = new Map<string, number>();
    requests.forEach((request) => {
      const id = request.repairJob?.activeAssignment?.technicianId.toString();
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return counts;
  }

  private toTechnician(
    user: {
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      email: string;
      countryCode?: string;
      mobileNumber?: string;
      profileImageData?: string;
      accountLifecycleStatus?: string;
      technicianDetails?: User['technicianDetails'];
      createdAt?: Date;
    },
    workload: number,
  ) {
    const profile = user.technicianDetails;
    const isActive = user.accountLifecycleStatus === 'active';
    const availability = !isActive
      ? 'inactive'
      : profile?.availabilityPreference === 'on_leave'
        ? 'on_leave'
        : workload > 0
          ? 'busy'
          : 'available';
    return {
      id: user._id.toString(),
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
      phone: `${user.countryCode ?? ''} ${user.mobileNumber ?? ''}`.trim(),
      countryCode: user.countryCode ?? '',
      mobileNumber: user.mobileNumber ?? '',
      profileImageData: user.profileImageData ?? null,
      employeeId: profile?.employeeId ?? '',
      skills: profile?.skills ?? [],
      specialization: profile?.specialization ?? '',
      experienceYears: profile?.experienceYears ?? 0,
      employmentType: profile?.employmentType ?? 'full_time',
      joiningDate: profile?.joiningDate ?? null,
      availabilityPreference: profile?.availabilityPreference ?? 'available',
      status: isActive ? 'active' : 'inactive',
      availability,
      workload,
      accountCreatedAt: user.createdAt ?? null,
    };
  }

  private validateNames(firstName: string, lastName: string) {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last)
      throw new BadRequestException('Full name is required.');
    return { firstName: first, lastName: last };
  }

  private normalizeSkills(skills: string[]) {
    const normalized = skills.map((skill) => skill.trim()).filter(Boolean);
    if (
      normalized.length !== skills.length ||
      normalized.some((skill) => skill.length > 60)
    ) {
      throw new BadRequestException(
        'Each skill must be non-empty and at most 60 characters.',
      );
    }
    return normalized;
  }

  private objectId(value: string, message: string): Types.ObjectId {
    if (!isObjectIdOrHexString(value)) throw new NotFoundException(message);
    return new Types.ObjectId(value);
  }

  private handleDuplicateKey(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Email, phone, or employee ID is already in use.',
      );
    }
  }
}
