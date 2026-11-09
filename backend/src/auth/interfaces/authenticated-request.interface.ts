import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  cookies: Record<string, string | undefined>;
  auth?: {
    userId: string;
    email: string;
  };
}
