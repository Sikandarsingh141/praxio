export interface UserNameFields {
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
}

export function userNameParts(user: UserNameFields): {
  firstName: string;
  lastName: string;
} {
  const firstName = asNamePart(user.firstName);
  const lastName = asNamePart(user.lastName);
  const legacyName = asNamePart(user.fullName);
  const legacyParts = legacyName.split(/\s+/).filter(Boolean);
  return {
    firstName: firstName || legacyParts[0] || '',
    lastName: lastName || legacyParts.slice(1).join(' '),
  };
}

export function formatUserName(user: UserNameFields): string {
  const { firstName, lastName } = userNameParts(user);
  return [firstName, lastName].filter(Boolean).join(' ');
}

function asNamePart(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
