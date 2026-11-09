import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type Messaging,
} from 'firebase-admin/messaging';

@Injectable()
export class FirebaseMessagingService {
  private readonly logger = new Logger(FirebaseMessagingService.name);
  private readonly messaging: Messaging | null;

  constructor(config: ConfigService) {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY');
    if (!projectId && !clientEmail && !privateKey) {
      this.messaging = null;
      this.logger.warn(
        'Firebase push is disabled; configure the Firebase Admin environment variables to enable it.',
      );
      return;
    }
    if (!projectId || !clientEmail || !privateKey) {
      this.messaging = null;
      this.logger.error(
        'Firebase push is disabled because FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be configured.',
      );
      return;
    }

    try {
      const app =
        getApps().find(
          (candidate) => candidate.name === 'praxio-notifications',
        ) ??
        initializeApp(
          {
            credential: cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
            projectId,
          },
          'praxio-notifications',
        );
      this.messaging = getMessaging(app);
    } catch (error) {
      this.messaging = null;
      this.logger.error(
        'Firebase push is disabled because the Admin credentials are invalid.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async send(
    tokens: string[],
    title: string,
    message: string,
    data: Record<string, string>,
  ): Promise<string[]> {
    if (!this.messaging || tokens.length === 0) {
      return [];
    }

    const invalidTokens: string[] = [];
    for (let index = 0; index < tokens.length; index += 500) {
      const batch = tokens.slice(index, index + 500);
      let response: BatchResponse;
      try {
        response = await this.messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body: message },
          data,
        });
      } catch (error) {
        this.logger.error(
          `Firebase push batch failed (${batch.length} token(s)).`,
          error instanceof Error ? error.stack : String(error),
        );
        continue;
      }

      response.responses.forEach((result, responseIndex) => {
        if (
          !result.success &&
          (result.error?.code ===
            'messaging/registration-token-not-registered' ||
            result.error?.code === 'messaging/invalid-registration-token')
        ) {
          const invalidToken = batch[responseIndex];
          if (invalidToken) {
            invalidTokens.push(invalidToken);
          }
        } else if (!result.success) {
          this.logger.warn(
            `Firebase push delivery failed: ${result.error?.code ?? 'unknown error'}`,
          );
        }
      });
    }
    return invalidTokens;
  }
}
