import type { RepairWorkflowJob } from '../models/repair-workflow.models';

export function canStartRepair(
  job: RepairWorkflowJob | undefined,
  acceptedQuotationStatus: string | undefined,
): boolean {
  const inspection = job?.inspection;
  return (
    job?.status === 'inspection_approved' &&
    inspection?.status === 'approved' &&
    !!inspection.decidedBy &&
    acceptedQuotationStatus === 'accepted' &&
    !(job.additionalChargeRequests ?? []).some(
      (charge) => charge.status === 'pending' && charge.blocksRepair,
    )
  );
}
