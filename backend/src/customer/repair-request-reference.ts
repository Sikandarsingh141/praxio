import { Types } from 'mongoose';

export function formatRepairRequestReference(
  requestId: string | Types.ObjectId,
): string {
  return requestId.toString().slice(-8).toUpperCase();
}

export function includeRepairRequestReference(
  message: string,
  requestId: string | Types.ObjectId,
): string {
  const reference = formatRepairRequestReference(requestId);
  const withoutUuid = message.replace(
    new RegExp(requestId.toString(), 'gi'),
    reference,
  );
  const requestIdLabel = /Request ID:\s*[A-Z0-9-]+/i;
  if (requestIdLabel.test(withoutUuid)) {
    return withoutUuid.replace(requestIdLabel, `Request ID: ${reference}`);
  }
  return `${withoutUuid.trimEnd()} Request ID: ${reference}.`;
}
