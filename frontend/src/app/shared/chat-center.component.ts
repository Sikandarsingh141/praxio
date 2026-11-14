import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Socket } from 'socket.io-client';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatService,
  EligibleChat,
  ChatMessageSearchPage,
} from './chat.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from './confirmation-dialog.component';

@Component({
  selector: 'app-chat-center',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './chat-center.component.html',
})
export class ChatCenterComponent implements OnInit, OnDestroy {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private socket?: Socket;
  private readonly subscriptions = new Subscription();
  private typingTimer?: ReturnType<typeof setTimeout>;
  private readonly urlByFile = new Map<string, string>();
  private readonly pendingFileUrls = new Map<File, string>();
  private readonly seenMessageEvents = new Set<string>();
  private readonly onlineUserIds = new Set<string>();
  private unreadCountUpdatedHandler?: (event: {
    conversationId: string;
    unreadCount: number;
  }) => void;
  @ViewChild('chatThread') private chatThread?: ElementRef<HTMLDivElement>;

  readonly conversations = signal<ChatConversation[]>([]);
  readonly selected = signal<ChatConversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly eligible = signal<EligibleChat[]>([]);
  readonly filter = signal<'all' | 'active' | 'archived'>('all');
  readonly query = signal('');
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly searchingConversations = signal(false);
  readonly sending = signal(false);
  readonly loadingOlder = signal(false);
  readonly loadingNewer = signal(false);
  readonly hasMoreMessages = signal(false);
  readonly hasMoreNewerMessages = signal(false);
  readonly newMessagesCount = signal(0);
  readonly hasMoreConversations = signal(false);
  readonly totalConversations = signal(0);
  readonly conversationPage = signal(1);
  private conversationSearchSequence = 0;
  readonly showNewConversation = signal(false);
  readonly typing = signal(false);
  readonly error = signal('');
  readonly copiedId = signal('');
  readonly replyTarget = signal<ChatMessage | null>(null);
  readonly editTarget = signal<ChatMessage | null>(null);
  readonly pendingFiles = signal<File[]>([]);
  readonly uploadedFiles = signal<ChatAttachment[]>([]);
  readonly uploadProgress = signal<number | null>(null);
  readonly loadingMessages = signal(false);
  readonly socketConnected = signal(false);
  readonly participantOnline = signal(false);
  readonly showMessageSearch = signal(false);
  readonly messageSearchQuery = signal('');
  readonly messageSearchResults = signal<ChatMessage[]>([]);
  readonly searchingMessages = signal(false);
  readonly hasSearchedMessages = signal(false);
  readonly searchHasMore = signal(false);
  readonly searchPage = signal(1);
  readonly failedProfileImages = signal<Set<string>>(new Set());
  readonly conversationMenuOpen = signal(false);
  readonly pendingClientMessageId = signal('');
  readonly emojiOpen = signal(false);
  readonly actionMenu = signal('');
  readonly pendingDelete = signal<ChatMessage | null>(null);
  readonly deleteDialogConfig: ConfirmationDialogConfig = {
    title: 'Delete this message?',
    message: 'This message will be removed for everyone in the conversation.',
    confirmLabel: 'Delete message',
    cancelLabel: 'Cancel',
    destructive: true,
  };
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');
  readonly currentRole = computed(() => this.auth.currentUser()?.accountType ?? 'customer');
  readonly canSend = computed(
    () =>
      !this.sending() &&
      (!!this.draft().trim() || this.pendingFiles().length > 0 || this.uploadedFiles().length > 0),
  );
  readonly filteredConversations = computed(() => this.conversations());

  ngOnInit(): void {
    this.socket = this.chat.connect();
    this.bindSocket();
    this.loadLists();
  }

  toggleMessageSearch(): void {
    this.showMessageSearch.update((showing) => !showing);
    if (!this.showMessageSearch()) this.clearMessageSearch();
  }

  searchMessages(loadMore = false): void {
    const conversation = this.selected();
    const query = this.messageSearchQuery().trim();
    if (!conversation || !query || this.searchingMessages()) return;
    const page = loadMore ? this.searchPage() + 1 : 1;
    if (loadMore && !this.searchHasMore()) return;
    if (!loadMore) {
      this.messageSearchResults.set([]);
      this.searchHasMore.set(false);
      this.hasSearchedMessages.set(true);
    }
    this.searchingMessages.set(true);
    this.chat.searchMessages(conversation.id, query, page).subscribe({
      next: (result: ChatMessageSearchPage) => {
        if (this.selected()?.id !== conversation.id) return;
        this.messageSearchResults.update((items) =>
          loadMore ? [...items, ...result.messages] : result.messages,
        );
        this.searchHasMore.set(result.hasMore);
        this.searchPage.set(result.page);
      },
      error: () => {
        this.searchingMessages.set(false);
        this.error.set('Messages could not be searched. Please try again.');
      },
      complete: () => this.searchingMessages.set(false),
    });
  }

  clearMessageSearch(): void {
    this.messageSearchQuery.set('');
    this.messageSearchResults.set([]);
    this.searchingMessages.set(false);
    this.hasSearchedMessages.set(false);
    this.searchHasMore.set(false);
    this.searchPage.set(1);
  }

  jumpToSearchMessage(message: ChatMessage): void {
    const conversation = this.selected();
    if (!conversation) return;
    this.loadingMessages.set(true);
    this.chat.getMessagesAround(conversation.id, message.id).subscribe({
      next: (page) => {
        if (this.selected()?.id !== conversation.id) return;
        this.messages.set(page.messages);
        this.hasMoreMessages.set(page.hasMoreOlder);
        this.hasMoreNewerMessages.set(page.hasMoreNewer);
        this.showMessageSearch.set(false);
        this.loadingMessages.set(false);
        this.loadImagePreviews(page.messages);
        requestAnimationFrame(() => {
          const target = document.getElementById(`message-${message.id}`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target?.classList.add('search-highlight');
          if (target) setTimeout(() => target.classList.remove('search-highlight'), 1800);
        });
      },
      error: () => {
        this.loadingMessages.set(false);
        this.error.set('The selected message could not be opened.');
      },
    });
  }

  private createClientMessageId(): string {
    const id = globalThis.crypto.randomUUID();
    this.pendingClientMessageId.set(id);
    return id;
  }

  private setParticipantPresence(userId: string, isOnline: boolean, conversationId: string): void {
    if (isOnline) this.onlineUserIds.add(userId);
    else this.onlineUserIds.delete(userId);
    const conversation = this.selected();
    if (conversation?.id === conversationId && conversation.participant.id === userId) {
      this.participantOnline.set(isOnline);
    }
  }

  ngOnDestroy(): void {
    const selected = this.selected();
    if (selected) this.socket?.emit('leave_conversation', { conversationId: selected.id });
    for (const event of [
      'connect',
      'disconnect',
      'new_message',
      'message_edited',
      'conversation_updated',
      'message_deleted',
      'message_delivered',
      'messages_read',
      'user_typing',
      'user_stopped_typing',
      'participant_presence',
      'user_online',
      'user_offline',
    ]) {
      this.socket?.off(event);
    }
    if (this.unreadCountUpdatedHandler) {
      this.socket?.off('unread_count_updated', this.unreadCountUpdatedHandler);
    }
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.subscriptions.unsubscribe();
    for (const url of this.urlByFile.values()) URL.revokeObjectURL(url);
    this.revokePendingFilePreviews();
  }

  loadLists(searchRequest = false): void {
    const requestSequence = ++this.conversationSearchSequence;
    this.loading.set(true);
    this.searchingConversations.set(searchRequest);
    this.error.set('');
    this.conversationPage.set(1);
    this.chat.listConversations(this.filter(), this.query()).subscribe({
      next: ({ conversations: items, hasMore, total }) => {
        if (requestSequence !== this.conversationSearchSequence) return;
        this.conversations.set(items);
        this.hasMoreConversations.set(hasMore);
        this.totalConversations.set(total);
        const requestedId = this.route.snapshot.queryParamMap.get('conversationId');
        const requested = requestedId ? items.find((item) => item.id === requestedId) : undefined;
        const current = this.selected();
        const selected = requested ?? items.find((item) => item.id === current?.id) ?? items[0];
        this.loading.set(false);
        this.searchingConversations.set(false);
        if (selected) this.openConversation(selected);
        else {
          this.selected.set(null);
          this.messages.set([]);
        }
      },
      error: () => {
        if (requestSequence !== this.conversationSearchSequence) return;
        this.loading.set(false);
        this.searchingConversations.set(false);
        this.error.set('Conversations could not be loaded. Please try again.');
      },
    });
    this.chat.getEligible().subscribe({
      next: (items) => this.eligible.set(items),
      error: () => this.error.set('Repair conversations are temporarily unavailable.'),
    });
  }

  loadMoreConversations(): void {
    if (!this.hasMoreConversations()) return;
    const page = this.conversationPage() + 1;
    this.chat.listConversations(this.filter(), this.query(), page).subscribe({
      next: ({ conversations, hasMore, total }) => {
        this.conversations.update((current) => [...current, ...conversations]);
        this.conversationPage.set(page);
        this.hasMoreConversations.set(hasMore);
        this.totalConversations.set(total);
      },
      error: () => this.error.set('More conversations could not be loaded.'),
    });
  }

  changeFilter(filter: 'all' | 'active' | 'archived'): void {
    this.filter.set(filter);
    this.loadLists();
  }

  search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.loadLists(true);
  }

  openConversation(conversation: ChatConversation): void {
    const previous = this.selected();
    if (previous?.id === conversation.id && this.messages().length) return;
    if (previous) this.socket?.emit('leave_conversation', { conversationId: previous.id });
    this.selected.set(conversation);
    this.messages.set([]);
    this.hasMoreMessages.set(false);
    this.hasMoreNewerMessages.set(false);
    this.participantOnline.set(this.onlineUserIds.has(conversation.participant.id));
    this.newMessagesCount.set(0);
    this.typing.set(false);
    this.loadingOlder.set(false);
    this.loadingMessages.set(true);
    this.showMessageSearch.set(false);
    this.messageSearchQuery.set('');
    this.messageSearchResults.set([]);
    this.hasSearchedMessages.set(false);
    this.searchHasMore.set(false);
    this.searchPage.set(1);
    this.error.set('');
    this.socket?.emit('join_conversation', { conversationId: conversation.id });
    this.chat.getMessages(conversation.id).subscribe({
      next: (page) => {
        if (this.selected()?.id !== conversation.id) return;
        const messages = page.messages;
        const historyIds = new Set(messages.map((message) => message.id));
        const liveMessages = this.messages().filter((message) => !historyIds.has(message.id));
        const completeHistory = [...messages, ...liveMessages].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
        this.messages.set(completeHistory);
        this.hasMoreMessages.set(page.hasMore);
        this.loadingMessages.set(false);
        this.loadImagePreviews(completeHistory);
        this.chat.markRead(conversation.id).subscribe({
          error: () => this.error.set('Read status could not be updated.'),
        });
        this.conversations.update((list) =>
          list.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item)),
        );
        this.scrollToBottom();
      },
      error: () => {
        this.loadingMessages.set(false);
        if (this.selected()?.id === conversation.id) {
          this.error.set('Messages could not be loaded. Please try again.');
        }
      },
    });
  }

  goBackToConversations(): void {
    const conversation = this.selected();
    if (conversation) this.socket?.emit('leave_conversation', { conversationId: conversation.id });
    this.selected.set(null);
    this.messages.set([]);
    this.newMessagesCount.set(0);
  }

  startConversation(option: EligibleChat): void {
    this.chat.createConversation(option.repairRequestId, option.shopId).subscribe({
      next: (conversation) => {
        this.showNewConversation.set(false);
        const alreadyListed = this.conversations().some((item) => item.id === conversation.id);
        const open = (activeConversation: ChatConversation) => {
          this.conversations.update((items) => [
            activeConversation,
            ...items.filter((item) => item.id !== activeConversation.id),
          ]);
          if (!alreadyListed && this.filter() !== 'archived') {
            this.totalConversations.update((total) => total + 1);
          }
          this.selected.set(null);
          this.openConversation(activeConversation);
        };
        if (conversation.archived) {
          this.chat.setArchived(conversation.id, false).subscribe({
            next: () => open({ ...conversation, archived: false }),
            error: () => this.error.set('Conversation could not be reopened.'),
          });
        } else {
          open(conversation);
        }
      },
      error: () => this.error.set('Could not start this conversation.'),
    });
  }

  chooseFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    const allowed = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|txt)$/i;
    const valid = selected.filter(
      (file) => allowed.test(file.name) && file.size > 0 && file.size <= 10 * 1024 * 1024,
    );
    if (valid.length !== selected.length) {
      this.error.set('Choose JPG, PNG, WebP, PDF, DOC, DOCX, XLS, XLSX or TXT files up to 10 MB.');
    } else {
      this.error.set('');
    }
    const accepted = valid.slice(0, Math.max(0, 5 - this.pendingFiles().length));
    if (accepted.length < valid.length) {
      this.error.set('You can attach up to five files per message.');
    }
    this.pendingFiles.update((files) => [...files, ...accepted]);
    for (const file of accepted) {
      if (file.type.startsWith('image/') && !this.pendingFileUrls.has(file)) {
        this.pendingFileUrls.set(file, URL.createObjectURL(file));
      }
    }
    input.value = '';
  }

  removePendingFile(index: number): void {
    const files = this.pendingFiles();
    const removed = files[index];
    if (removed) {
      const url = this.pendingFileUrls.get(removed);
      if (url) URL.revokeObjectURL(url);
      this.pendingFileUrls.delete(removed);
    }
    this.pendingFiles.update((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  pendingFilePreview(file: File): string | null {
    if (!file.type.startsWith('image/')) return null;
    return this.pendingFileUrls.get(file) ?? null;
  }

  profileImageFailed(userId: string): boolean {
    return this.failedProfileImages().has(userId);
  }

  markProfileImageFailed(userId: string): void {
    this.failedProfileImages.update((failed) => new Set(failed).add(userId));
  }

  send(): void {
    const conversation = this.selected();
    if (!conversation || !this.canSend()) return;
    this.sending.set(true);
    this.error.set('');
    const uploaded = this.uploadedFiles();
    if (this.pendingFiles().length) {
      this.chat.uploadAttachments(conversation.id, this.pendingFiles()).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.uploadProgress.set(
              event.total ? Math.round((100 * event.loaded) / event.total) : null,
            );
          }
          if (event.type === HttpEventType.Response) {
            const data = event.body as { data?: { attachments?: ChatAttachment[] } } | null;
            const attachments = data?.data?.attachments ?? [];
            this.revokePendingFilePreviews();
            this.pendingFiles.set([]);
            this.uploadProgress.set(null);
            this.sendUploadedMessage(conversation, [...uploaded, ...attachments]);
          }
        },
        error: () => {
          this.sending.set(false);
          this.uploadProgress.set(null);
          this.error.set('Upload failed. Your files are still selected; retry sending.');
        },
      });
      return;
    }
    this.sendUploadedMessage(conversation, uploaded);
  }

  private sendUploadedMessage(conversation: ChatConversation, files: ChatAttachment[]): void {
    const content = this.draft().trim();
    const reply = this.replyTarget();
    if (this.editTarget()) {
      this.chat.editMessage(this.editTarget()!.id, content).subscribe({
        next: (updated) => {
          this.replaceMessage(updated);
          this.updateConversationPreview(updated, false, true);
          this.finishSend();
          this.pendingClientMessageId.set('');
        },
        error: () => {
          this.sending.set(false);
          this.error.set('Message could not be edited. Please retry.');
        },
      });
      return;
    }
    this.chat
      .sendMessage(conversation.id, {
        content,
        attachmentIds: files.map((item) => item.id),
        repliedToMessageId: reply?.id,
        clientMessageId: this.pendingClientMessageId() || this.createClientMessageId(),
      })
      .subscribe({
        next: (message) => {
          this.upsertMessage(message, true);
          this.updateConversationPreview(message, false, false, true);
          this.draft.set('');
          this.replyTarget.set(null);
          this.uploadedFiles.set([]);
          this.pendingClientMessageId.set('');
          this.finishSend();
          this.chat.markRead(conversation.id).subscribe({
            error: () => this.error.set('Read status could not be updated.'),
          });
        },
        error: () => {
          this.sending.set(false);
          this.error.set('Message could not be sent. Please retry.');
          this.uploadedFiles.set(files);
        },
      });
  }

  private finishSend(): void {
    this.sending.set(false);
    this.editTarget.set(null);
    this.replyTarget.set(null);
    this.draft.set('');
    this.scrollToBottom();
    this.socket?.emit('typing_stop', { conversationId: this.selected()?.id });
  }

  onDraftInput(): void {
    const conversation = this.selected();
    if (!conversation) return;
    this.socket?.emit('typing_start', { conversationId: conversation.id });
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(
      () => this.socket?.emit('typing_stop', { conversationId: conversation.id }),
      1200,
    );
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  setReply(message: ChatMessage): void {
    if (message.isDeleted) return;
    this.replyTarget.set(message);
    this.editTarget.set(null);
    this.draft.set('');
    this.actionMenu.set('');
  }

  setEdit(message: ChatMessage): void {
    if (message.senderId !== this.currentUserId() || message.isDeleted) return;
    this.editTarget.set(message);
    this.replyTarget.set(null);
    this.draft.set(message.content);
    this.actionMenu.set('');
  }

  cancelComposeAction(): void {
    this.replyTarget.set(null);
    this.editTarget.set(null);
    this.draft.set('');
  }

  delete(message: ChatMessage): void {
    if (message.senderId !== this.currentUserId() || message.isDeleted) return;
    this.pendingDelete.set(message);
    this.actionMenu.set('');
  }

  confirmDelete(): void {
    const message = this.pendingDelete();
    if (!message) return;
    this.pendingDelete.set(null);
    this.chat.deleteMessage(message.id).subscribe({
      next: (result) => {
        this.messages.update((items) =>
          items.map((item) =>
            item.id === message.id
              ? { ...item, content: '', attachments: [], isDeleted: true }
              : item,
          ),
        );
        this.conversations.update((items) =>
          items.map((item) =>
            item.id === result.conversationId
              ? {
                  ...item,
                  lastMessage: result.lastMessage,
                  lastMessageAt: result.lastMessageAt ?? item.lastMessageAt,
                }
              : item,
          ),
        );
      },
      error: () => this.error.set('Message could not be deleted.'),
    });
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async copy(message: ChatMessage): Promise<void> {
    if (!message.content || message.isDeleted) return;
    try {
      await navigator.clipboard.writeText(message.content);
      this.copiedId.set(message.id);
      this.actionMenu.set('');
      setTimeout(() => this.copiedId.set(''), 1500);
    } catch {
      this.error.set('Clipboard access is unavailable in this browser.');
    }
  }

  toggleActions(messageId: string): void {
    this.actionMenu.set(this.actionMenu() === messageId ? '' : messageId);
  }

  toggleEmojiPicker(): void {
    this.emojiOpen.update((open) => !open);
  }

  addEmoji(emoji: string): void {
    this.draft.update((text) => text + emoji);
    this.emojiOpen.set(false);
  }

  loadOlder(): void {
    const conversation = this.selected();
    const oldest = this.messages()[0];
    if (!conversation || !oldest || this.loadingOlder() || !this.hasMoreMessages()) return;
    this.loadingOlder.set(true);
    this.chat.getMessages(conversation.id, oldest.createdAt, oldest.id).subscribe({
      next: (page) => {
        this.loadingOlder.set(false);
        const older = page.messages;
        this.hasMoreMessages.set(page.hasMore);
        this.preserveScrollPosition(() => {
          this.messages.update((items) => {
            const existingIds = new Set(items.map((message) => message.id));
            const uniqueOlder = older.filter((message) => !existingIds.has(message.id));
            return [...uniqueOlder, ...items];
          });
        });
        this.loadImagePreviews(older);
      },
      error: () => {
        this.loadingOlder.set(false);
        this.error.set('Older messages could not be loaded.');
      },
    });
  }

  loadNewer(): void {
    const conversation = this.selected();
    const newest = this.messages()[this.messages().length - 1];
    if (!conversation || !newest || this.loadingNewer() || !this.hasMoreNewerMessages()) {
      return;
    }
    this.loadingNewer.set(true);
    this.chat
      .getMessages(conversation.id, undefined, undefined, newest.createdAt, newest.id)
      .subscribe({
        next: (page) => {
          this.loadingNewer.set(false);
          this.hasMoreNewerMessages.set(page.hasMore);
          const existingIds = new Set(this.messages().map((message) => message.id));
          const uniqueNewer = page.messages.filter((message) => !existingIds.has(message.id));
          if (!uniqueNewer.length) return;
          this.messages.update((items) => [...items, ...uniqueNewer]);
          this.loadImagePreviews(uniqueNewer);
          this.scrollToBottom();
        },
        error: () => {
          this.loadingNewer.set(false);
          this.error.set('Newer messages could not be loaded.');
        },
      });
  }

  toggleArchive(): void {
    const conversation = this.selected();
    if (!conversation) return;
    this.conversationMenuOpen.set(false);
    this.chat.setArchived(conversation.id, !conversation.archived).subscribe({
      next: () => this.loadLists(),
      error: () => this.error.set('Conversation status could not be updated.'),
    });
  }

  toggleConversationMenu(): void {
    this.conversationMenuOpen.update((open) => !open);
  }

  download(attachment: ChatAttachment): void {
    const conversationId = this.selected()?.id;
    if (!conversationId) return;
    this.chat.download(conversationId, attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Attachment could not be downloaded.'),
    });
  }

  highlightReply(messageId: string): void {
    this.chatThread?.nativeElement
      .querySelector(`#message-${CSS.escape(messageId)}`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
  }

  messageTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(value),
    );
  }

  dateLabel(value: string, previous?: string): string | null {
    const date = new Date(value);
    if (previous && new Date(previous).toDateString() === date.toDateString()) return null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (today.toDateString() === date.toDateString()) return 'Today';
    if (yesterday.toDateString() === date.toDateString()) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  requestReference(requestId: string): string {
    return requestId.slice(-8).toUpperCase();
  }

  initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUserIds.has(userId);
  }

  attachmentIsImage(attachment: ChatAttachment): boolean {
    return attachment.mimeType.startsWith('image/');
  }

  onChatThreadScroll(): void {
    const thread = this.chatThread?.nativeElement;
    if (!thread) return;
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 50;
    if (atBottom) {
      this.newMessagesCount.set(0);
      this.loadNewer();
      return;
    }
    if (thread.scrollTop < 50) this.loadOlder();
  }

  scrollToNewMessages(): void {
    this.newMessagesCount.set(0);
    this.scrollToBottom();
  }

  private bindSocket(): void {
    const socket = this.socket!;
    this.socketConnected.set(socket.connected);
    socket.on('connect', () => {
      const reconnecting = !this.socketConnected();
      this.socketConnected.set(true);
      const conversation = this.selected();
      if (conversation) {
        socket.emit('join_conversation', { conversationId: conversation.id });
        if (reconnecting && this.messages().length) {
          this.refreshMessages(conversation.id);
        }
      }
    });
    socket.on('disconnect', () => this.socketConnected.set(false));
    socket.on(
      'participant_presence',
      (event: { conversationId: string; userId: string; isOnline: boolean }) => {
        this.setParticipantPresence(event.userId, event.isOnline, event.conversationId);
      },
    );
    socket.on('user_online', (event: { userId: string }) => {
      this.onlineUserIds.add(event.userId);
      if (this.selected()?.participant.id === event.userId) this.participantOnline.set(true);
    });
    socket.on('user_offline', (event: { userId: string }) => {
      this.onlineUserIds.delete(event.userId);
      if (this.selected()?.participant.id === event.userId) this.participantOnline.set(false);
    });
    socket.on('new_message', (message: ChatMessage) => {
      const duplicate =
        this.seenMessageEvents.has(message.id) ||
        this.messages().some(
          (existing) =>
            existing.id === message.id ||
            (!!message.clientMessageId && existing.clientMessageId === message.clientMessageId),
        );
      this.seenMessageEvents.add(message.id);
      if (message.conversationId === this.selected()?.id) {
        const wasAtBottom = this.upsertMessage(message);
        if (!duplicate && message.senderId !== this.currentUserId() && !wasAtBottom) {
          this.newMessagesCount.update((count) => count + 1);
        }
        this.loadImagePreviews([message]);
        if (message.senderId !== this.currentUserId()) {
          this.chat.markRead(message.conversationId).subscribe({
            error: () => this.error.set('Read status could not be updated.'),
          });
        }
      }
      this.updateConversationPreview(message, !duplicate, false, !duplicate);
    });
    socket.on('message_edited', (message: ChatMessage) => {
      this.replaceMessage(message);
      this.updateConversationPreview(message, false, true);
    });
    socket.on(
      'conversation_updated',
      (event: { conversationId: string; lastMessage: string; lastMessageAt?: string }) => {
        this.updateConversationSummary(
          event.conversationId,
          event.lastMessage,
          event.lastMessageAt,
        );
      },
    );
    socket.on(
      'message_deleted',
      (payload: {
        id: string;
        conversationId: string;
        lastMessage: string;
        lastMessageAt?: string;
      }) => {
        this.messages.update((items) =>
          items.map((message) =>
            message.id === payload.id
              ? { ...message, content: '', attachments: [], isDeleted: true }
              : message,
          ),
        );
        this.conversations.update((items) =>
          items.map((item) =>
            item.id === payload.conversationId
              ? {
                  ...item,
                  lastMessage: payload.lastMessage,
                  lastMessageAt: payload.lastMessageAt ?? item.lastMessageAt,
                }
              : item,
          ),
        );
      },
    );
    socket.on(
      'message_delivered',
      (event: { conversationId: string; messageId: string; recipientId: string }) => {
        if (event.conversationId !== this.selected()?.id) return;
        this.messages.update((items) =>
          items.map((message) =>
            message.id === event.messageId
              ? {
                  ...message,
                  deliveredTo: [...new Set([...message.deliveredTo, event.recipientId])],
                }
              : message,
          ),
        );
      },
    );
    socket.on('messages_read', (event: { conversationId: string; readerId: string }) => {
      if (event.conversationId !== this.selected()?.id) return;
      this.messages.update((items) =>
        items.map((message) =>
          message.senderId === this.currentUserId()
            ? { ...message, readBy: [...new Set([...message.readBy, event.readerId])] }
            : message,
        ),
      );
    });
    socket.on('user_typing', () => this.typing.set(true));
    socket.on('user_stopped_typing', () => this.typing.set(false));
    this.unreadCountUpdatedHandler = (event: { conversationId: string; unreadCount: number }) => {
      this.conversations.update((items) =>
        items.map((item) =>
          item.id === event.conversationId ? { ...item, unreadCount: event.unreadCount } : item,
        ),
      );
    };
    socket.on('unread_count_updated', this.unreadCountUpdatedHandler);
  }

  private upsertMessage(message: ChatMessage, forceScroll = false): boolean {
    const thread = this.chatThread?.nativeElement;
    const wasNearBottom = thread
      ? thread.scrollHeight - thread.scrollTop - thread.clientHeight < 50
      : true;
    this.messages.update((items) => {
      const index = items.findIndex(
        (item) =>
          item.id === message.id ||
          (!!message.clientMessageId && item.clientMessageId === message.clientMessageId),
      );
      const updated = [...items];
      if (index < 0) updated.push(message);
      else updated[index] = message;
      return updated.sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    });
    if (forceScroll || wasNearBottom) {
      this.newMessagesCount.set(0);
      this.scrollToBottom();
    }
    return wasNearBottom;
  }

  private replaceMessage(message: ChatMessage): void {
    this.messages.update((items) => items.map((item) => (item.id === message.id ? message : item)));
  }

  private updateConversationPreview(
    message: ChatMessage,
    countUnread = true,
    onlyIfLatest = false,
    countMessage = false,
  ): void {
    const conversation = this.conversations().find((item) => item.id === message.conversationId);
    if (conversation && countMessage) {
      this.conversations.update((items) =>
        items.map((item) =>
          item.id === message.conversationId
            ? { ...item, messageCount: (item.messageCount ?? 0) + 1 }
            : item,
        ),
      );
    }
    if (
      conversation &&
      new Date(conversation.lastMessageAt).getTime() > new Date(message.createdAt).getTime()
    ) {
      return;
    }
    if (
      onlyIfLatest &&
      conversation &&
      new Date(conversation.lastMessageAt).getTime() !== new Date(message.createdAt).getTime()
    ) {
      return;
    }
    const preview = message.isDeleted
      ? 'This message was deleted.'
      : message.content || message.attachments[0]?.fileName || 'Attachment';
    this.conversations.update((items) =>
      items
        .map((item) =>
          item.id === message.conversationId
            ? {
                ...item,
                lastMessage: preview,
                lastMessageAt: message.createdAt,
                unreadCount:
                  countUnread &&
                  message.senderId !== this.currentUserId() &&
                  item.id !== this.selected()?.id
                    ? item.unreadCount + 1
                    : item.unreadCount,
              }
            : item,
        )
        .sort(
          (left, right) =>
            new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
        ),
    );
  }

  private updateConversationSummary(
    conversationId: string,
    lastMessage: string,
    lastMessageAt?: string,
  ): void {
    this.conversations.update((items) =>
      items
        .map((item) =>
          item.id === conversationId
            ? {
                ...item,
                lastMessage,
                lastMessageAt: lastMessageAt ?? item.lastMessageAt,
              }
            : item,
        )
        .sort(
          (left, right) =>
            new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
        ),
    );
  }

  private loadImagePreviews(messages: ChatMessage[]): void {
    const conversationId = this.selected()?.id;
    if (!conversationId) return;
    for (const message of messages) {
      for (const attachment of message.attachments) {
        if (!this.attachmentIsImage(attachment) || this.urlByFile.has(attachment.id)) continue;
        this.chat.download(conversationId, attachment.id).subscribe({
          next: (blob) => {
            if (this.selected()?.id !== conversationId) return;
            const url = URL.createObjectURL(blob);
            this.urlByFile.set(attachment.id, url);
            this.preserveScrollPosition(() =>
              this.messages.update((items) =>
                items.map((item) => ({
                  ...item,
                  attachments: item.attachments.map((file) =>
                    file.id === attachment.id ? { ...file, previewUrl: url } : file,
                  ),
                })),
              ),
            );
          },
        });
      }
    }
  }

  private refreshMessages(conversationId: string): void {
    this.chat.getMessages(conversationId).subscribe({
      next: (page) => {
        if (this.selected()?.id !== conversationId) return;
        const latestMessages = page.messages;
        const thread = this.chatThread?.nativeElement;
        const wasNearBottom = thread
          ? thread.scrollHeight - thread.scrollTop - thread.clientHeight < 50
          : true;
        const merged = new Map(this.messages().map((message) => [message.id, message]));
        for (const message of latestMessages) merged.set(message.id, message);
        const refreshed = [...merged.values()].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
        this.messages.set(refreshed);
        this.hasMoreMessages.set(page.hasMore || this.hasMoreMessages());
        this.hasMoreNewerMessages.set(false);
        this.loadImagePreviews(latestMessages);
        if (wasNearBottom) this.scrollToBottom();
        this.chat.markRead(conversationId).subscribe({
          error: () => this.error.set('Read status could not be updated.'),
        });
      },
      error: () => this.error.set('Messages could not be synchronized after reconnecting.'),
    });
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const thread = this.chatThread?.nativeElement;
      if (thread) {
        thread.scrollTop = thread.scrollHeight;
        this.newMessagesCount.set(0);
        requestAnimationFrame(() => {
          if (this.chatThread?.nativeElement === thread) {
            thread.scrollTop = thread.scrollHeight;
          }
        });
      }
    });
  }

  private preserveScrollPosition(update: () => void): void {
    const thread = this.chatThread?.nativeElement;
    const previousHeight = thread?.scrollHeight ?? 0;
    const previousTop = thread?.scrollTop ?? 0;
    const wasAtBottom = thread
      ? thread.scrollHeight - thread.scrollTop - thread.clientHeight < 50
      : false;
    const threadTop = thread?.getBoundingClientRect().top ?? 0;
    const anchor = thread
      ? Array.from(thread.querySelectorAll<HTMLElement>('.message-row')).find(
          (element) => element.getBoundingClientRect().bottom > threadTop,
        )
      : undefined;
    const anchorId = anchor?.id;
    const anchorOffset = anchor ? anchor.getBoundingClientRect().top - threadTop : undefined;
    update();
    requestAnimationFrame(() => {
      const currentThread = this.chatThread?.nativeElement;
      if (!currentThread || currentThread !== thread) return;
      if (wasAtBottom) {
        currentThread.scrollTop = currentThread.scrollHeight;
        return;
      }
      const currentAnchor = anchorId
        ? currentThread.querySelector<HTMLElement>(`#${CSS.escape(anchorId)}`)
        : null;
      if (currentAnchor && anchorOffset !== undefined) {
        const offset =
          currentAnchor.getBoundingClientRect().top - currentThread.getBoundingClientRect().top;
        currentThread.scrollTop += offset - anchorOffset;
        return;
      }
      currentThread.scrollTop = previousTop + currentThread.scrollHeight - previousHeight;
    });
  }

  private revokePendingFilePreviews(): void {
    for (const url of this.pendingFileUrls.values()) URL.revokeObjectURL(url);
    this.pendingFileUrls.clear();
  }
}
