import { HttpClient, HttpContext, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { SKIP_GLOBAL_LOADER } from '../core/loading/global-loader.context';
import { environment } from '../../environments/environment';
import { ToastService } from '../core/toast/toast.service';
import { AuthService } from '../core/auth/auth.service';

export interface ChatParticipant {
  id: string;
  name: string;
  profileImageUrl: string | null;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: ChatParticipant;
  senderRole: 'customer' | 'shop' | 'technician';
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  content: string;
  attachments: ChatAttachment[];
  repliedTo: { id: string; content: string; isDeleted: boolean } | null;
  clientMessageId?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  deliveredTo: string[];
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  repairRequest?: {
    id: string;
    appliance: string;
    status: string;
  };
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface ChatMessageSearchPage {
  messages: ChatMessage[];
  page: number;
  hasMore: boolean;
}

export interface ChatMessagesAroundPage {
  messages: ChatMessage[];
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
}

export interface ChatDeletedMessage {
  id: string;
  conversationId: string;
  isDeleted: true;
  deletedAt?: string;
  lastMessage: string;
  lastMessageAt?: string;
}

export interface ChatConversation {
  id: string;
  participant: ChatParticipant;
  repairRequest: { id: string; appliance: string; status: string };
  lastMessage: string;
  lastMessageAt: string;
  messageCount?: number;
  unreadCount: number;
  archived: boolean;
}

export interface EligibleChat {
  repairRequestId: string;
  appliance: string;
  repairStatus: string;
  shopId: string;
  participant: ChatParticipant;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket: Socket | null = null;
  private readonly baseUrl = `${environment.apiBaseUrl}/chat`;
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly unreadMessageCount = signal(0);
  readonly unreadMessageCountError = signal('');
  readonly activeConversationId = signal<string | null>(null);
  readonly onlineUserIds = new Set<string>();

  constructor(private readonly http: HttpClient) {}

  private silentContext(): HttpContext {
    return new HttpContext().set(SKIP_GLOBAL_LOADER, true);
  }

  refreshUnreadMessageCount(): void {
    this.http
      .get<{ data: { unreadCount: number } }>(`${this.baseUrl}/unread-count`, {
        context: this.silentContext(),
      })
      .subscribe({
        next: (response) => {
          this.unreadMessageCount.set(response.data.unreadCount);
          this.unreadMessageCountError.set('');
        },
        error: () =>
          this.unreadMessageCountError.set('Unread message count could not be refreshed.'),
      });
  }

  listConversations(
    filter = 'all',
    search = '',
    page = 1,
  ): Observable<{
    conversations: ChatConversation[];
    hasMore: boolean;
    total: number;
  }> {
    const params = new HttpParams()
      .set('filter', filter)
      .set('search', search)
      .set('page', page)
      .set('limit', 25);
    return this.http
      .get<{
        data: { conversations: ChatConversation[]; hasMore: boolean; total: number };
      }>(`${this.baseUrl}/conversations`, { params, context: this.silentContext() })
      .pipe(
        map((response) => ({
          conversations: response.data.conversations,
          hasMore: response.data.hasMore,
          total: response.data.total,
        })),
      );
  }

  getEligible(): Observable<EligibleChat[]> {
    return this.http
      .get<{ data: { options: EligibleChat[] } }>(`${this.baseUrl}/eligible`, {
        context: this.silentContext(),
      })
      .pipe(map((response) => response.data.options));
  }

  createConversation(repairRequestId: string, shopId: string): Observable<ChatConversation> {
    return this.http
      .post<{ data: { conversation: ChatConversation } }>(
        `${this.baseUrl}/conversations`,
        {
          repairRequestId,
          shopId,
        },
        { context: this.silentContext() },
      )
      .pipe(map((response) => response.data.conversation));
  }

  getMessages(
    conversationId: string,
    before?: string,
    beforeId?: string,
    after?: string,
    afterId?: string,
  ): Observable<ChatMessagePage> {
    let params = new HttpParams();
    if (before) params = params.set('before', before);
    if (beforeId) params = params.set('beforeId', beforeId);
    if (after) params = params.set('after', after);
    if (afterId) params = params.set('afterId', afterId);
    return this.http
      .get<{ data: ChatMessagePage }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`,
        { params, context: this.silentContext() },
      )
      .pipe(map((response) => response.data));
  }

  searchMessages(
    conversationId: string,
    query: string,
    page = 1,
  ): Observable<ChatMessageSearchPage> {
    const params = new HttpParams().set('q', query).set('page', page);
    return this.http
      .get<{ data: ChatMessageSearchPage }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/search`,
        { params, context: this.silentContext() },
      )
      .pipe(map((response) => response.data));
  }

  getMessagesAround(conversationId: string, messageId: string): Observable<ChatMessagesAroundPage> {
    return this.http
      .get<{ data: ChatMessagesAroundPage }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages/around/${encodeURIComponent(messageId)}`,
        { context: this.silentContext() },
      )
      .pipe(map((response) => response.data));
  }

  sendMessage(
    conversationId: string,
    input: {
      content: string;
      attachmentIds: string[];
      repliedToMessageId?: string;
      clientMessageId: string;
    },
  ): Observable<ChatMessage> {
    return this.http
      .post<{ data: { message: ChatMessage } }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`,
        input,
        { context: this.silentContext() },
      )
      .pipe(map((response) => response.data.message));
  }

  uploadAttachments(conversationId: string, files: File[]): Observable<HttpEvent<unknown>> {
    const body = new FormData();
    for (const file of files) body.append('files', file);
    return this.http.post<{ data: { attachments: Array<Omit<ChatAttachment, 'uploadedAt'>> } }>(
      `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/attachments`,
      body,
      { observe: 'events', reportProgress: true, context: this.silentContext() },
    );
  }

  editMessage(messageId: string, content: string): Observable<ChatMessage> {
    return this.http
      .patch<{ data: { message: ChatMessage } }>(
        `${this.baseUrl}/messages/${encodeURIComponent(messageId)}`,
        { content },
        { context: this.silentContext() },
      )
      .pipe(map((response) => response.data.message));
  }

  deleteMessage(messageId: string): Observable<ChatDeletedMessage> {
    return this.http
      .delete<{ data: { message: ChatDeletedMessage } }>(
        `${this.baseUrl}/messages/${encodeURIComponent(messageId)}`,
        { context: this.silentContext() },
      )
      .pipe(map((response) => response.data.message));
  }

  markRead(conversationId: string): Observable<void> {
    return this.http
      .patch<{ data: { read: true } }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/read`,
        {},
        { context: this.silentContext() },
      )
      .pipe(map(() => undefined));
  }

  setArchived(conversationId: string, archived: boolean): Observable<void> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http
      .patch<{ data: { conversation: { archived: boolean } } }>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/archive`,
        {},
        { params, context: this.silentContext() },
      )
      .pipe(map(() => undefined));
  }

  download(conversationId: string, fileId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(fileId)}/download`,
      { responseType: 'blob', context: this.silentContext() },
    );
  }

  connect(): Socket {
    if (!this.socket) {
      const apiOrigin = new URL(environment.apiBaseUrl, globalThis.location.origin).origin;
      let token: string | null = null;
      try {
        token = sessionStorage.getItem('fixora_access_token') || localStorage.getItem('fixora_access_token');
      } catch {
        // storage restricted
      }
      this.socket = io(`${apiOrigin}/chat`, {
        path: '/api/socket.io',
        withCredentials: true,
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      this.socket.on('unread_count_updated', () => this.refreshUnreadMessageCount());
      this.socket.on('user_online', (event: { userId: string }) => {
        if (event?.userId) this.onlineUserIds.add(event.userId);
      });
      this.socket.on('user_offline', (event: { userId: string }) => {
        if (event?.userId) this.onlineUserIds.delete(event.userId);
      });
      this.socket.on(
        'participant_presence',
        (event: { userId: string; isOnline: boolean }) => {
          if (event?.userId) {
            if (event.isOnline) this.onlineUserIds.add(event.userId);
            else this.onlineUserIds.delete(event.userId);
          }
        },
      );
      this.socket.on('new_message', (message: ChatMessage) => {
        this.handleIncomingMessageToast(message);
      });
    }
    return this.socket;
  }

  private handleIncomingMessageToast(message: ChatMessage): void {
    if (!message || !message.senderId) return;

    // Do not notify for the currently logged-in user's own outgoing messages
    const currentUser = this.auth.currentUser();
    if (!currentUser || message.senderId === currentUser.id) return;

    // Do not pop up a toast if user is already actively viewing this conversation
    if (this.activeConversationId() === message.conversationId) return;

    // Always update the unread count in real-time
    this.refreshUnreadMessageCount();

    const role = currentUser.accountType || 'customer';
    const destinationUrl =
      role === 'shop'
        ? `/shop/messages?conversationId=${encodeURIComponent(message.conversationId)}`
        : `/customer/messages?conversationId=${encodeURIComponent(message.conversationId)}`;

    const repairItem = message.repairRequest?.appliance || 'Repair Request';
    const rawId = message.repairRequest?.id || '';
    const requestId = rawId ? `#${rawId.slice(-8).toUpperCase()}` : '';

    let content = message.content?.trim();
    if (!content && message.attachments?.length) {
      content =
        message.attachments.length === 1
          ? 'Sent an attachment'
          : `Sent ${message.attachments.length} attachments`;
    }

    const isOnline = this.onlineUserIds.has(message.senderId) ? true : undefined;

    this.toast.showRealtimeMessage({
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.sender?.name || 'User',
      senderPhoto: message.sender?.profileImageUrl,
      isOnline,
      repairItem,
      requestId,
      content: content || 'New message',
      destinationUrl,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
