import { NotificationSchema } from './notification.schema';

describe('NotificationSchema', () => {
  it('indexes a recipient notification inbox by read state and date', () => {
    expect(NotificationSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { recipientId: 1, isRead: 1, createdAt: -1 },
          expect.objectContaining({
            name: 'IX_notifications_recipient_read_created',
          }),
        ],
      ]),
    );
  });
});
