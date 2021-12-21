import type { Principal } from "@dfinity/principal";
export type AccountIdentifier = string;
export interface AddedToGroupNotification {
    added_by_name: string;
    added_by: UserId;
    chat_id: ChatId;
    group_name: string;
}
export interface Alert {
    id: string;
    details: AlertDetails;
    elapsed: Milliseconds;
}
export type AlertDetails =
    | { GroupDeleted: GroupDeletedAlert }
    | { CryptocurrencyDepositReceived: CryptocurrencyDeposit }
    | { RemovedFromGroup: RemovedFromGroupAlert }
    | { BlockedFromGroup: RemovedFromGroupAlert };
export type AlertId = { Internal: number } | { GroupDeleted: ChatId };
export interface AssumeGroupSuperAdminArgs {
    chat_id: ChatId;
}
export type AssumeGroupSuperAdminResponse =
    | { AlreadyOwner: null }
    | { CallerNotInGroup: null }
    | { Success: null }
    | { NotSuperAdmin: null }
    | { InternalError: string }
    | { AlreadySuperAdmin: null };
export interface AudioContent {
    mime_type: string;
    blob_reference: [] | [BlobReference];
    caption: [] | [string];
}
export interface Avatar {
    id: bigint;
    data: Array<number>;
    mime_type: string;
}
export interface AvatarChanged {
    changed_by: UserId;
    previous_avatar: [] | [bigint];
    new_avatar: bigint;
}
export interface BlobReference {
    blob_id: bigint;
    canister_id: CanisterId;
}
export type BlockHeight = bigint;
export interface BlockUserArgs {
    user_id: UserId;
}
export type BlockUserResponse = { Success: null };
export type CanisterCreationStatus = { InProgress: null } | { Created: null } | { Pending: null };
export type CanisterId = Principal;
export type CanisterUpgradeStatus =
    | { Required: null }
    | { NotRequired: null }
    | { InProgress: null };
export interface CanisterWasm {
    compressed: boolean;
    version: Version;
    module: Array<number>;
}
export type ChatId = CanisterId;
export interface ChatMessagesRead {
    message_ranges: Array<MessageIndexRange>;
    chat_id: ChatId;
}
export type ChatSummary = { Group: GroupChatSummary } | { Direct: DirectChatSummary };
export type ChatSummaryUpdates =
    | { Group: GroupChatSummaryUpdates }
    | { Direct: DirectChatSummaryUpdates };
export interface CompletedCyclesDeposit {
    from: CanisterId;
    cycles: Cycles;
}
export interface CompletedCyclesTransfer {
    recipient: UserId;
    sender: UserId;
    cycles: Cycles;
}
export interface CompletedCyclesWithdrawal {
    to: CanisterId;
    cycles: Cycles;
}
export interface CompletedICPDeposit {
    memo: bigint;
    fee_e8s: bigint;
    amount_e8s: bigint;
    from_address: string;
    block_height: BlockHeight;
}
export interface CompletedICPTransfer {
    memo: bigint;
    recipient: UserId;
    fee_e8s: bigint;
    sender: UserId;
    amount_e8s: bigint;
    block_height: BlockHeight;
}
export interface CompletedICPWithdrawal {
    to: string;
    memo: bigint;
    fee_e8s: bigint;
    amount_e8s: bigint;
    block_height: BlockHeight;
}
export interface ConfirmationCodeSms {
    confirmation_code: string;
    phone_number: string;
}
export interface CreateGroupArgs {
    is_public: boolean;
    name: string;
    description: string;
    history_visible_to_new_joiners: boolean;
    avatar: [] | [Avatar];
}
export type CreateGroupResponse =
    | {
          DescriptionTooLong: FieldTooLongResult;
      }
    | { Throttled: null }
    | { AvatarTooBig: FieldTooLongResult }
    | { Success: CreateGroupSuccessResult }
    | { NameTooLong: FieldTooLongResult }
    | { NameTaken: null }
    | { MaxGroupsCreated: number }
    | { InternalError: null };
export interface CreateGroupSuccessResult {
    chat_id: ChatId;
}
export type Cryptocurrency = { ICP: null } | { Cycles: null };
export interface CryptocurrencyAccount {
    currency: Cryptocurrency;
    address: string;
}
export interface CryptocurrencyContent {
    caption: [] | [string];
    transfer: CryptocurrencyTransfer;
}
export type CryptocurrencyDeposit = { ICP: ICPDeposit } | { Cycles: CyclesDeposit };
export type CryptocurrencyTransaction =
    | { Deposit: CryptocurrencyDeposit }
    | { Withdrawal: CryptocurrencyWithdrawal }
    | { Transfer: CryptocurrencyTransfer };
export type CryptocurrencyTransfer = { ICP: ICPTransfer } | { Cycles: CyclesTransfer };
export type CryptocurrencyWithdrawal = { ICP: ICPWithdrawal } | { Cycles: CyclesWithdrawal };
export type Cycles = bigint;
export type CyclesDeposit = { Completed: CompletedCyclesDeposit };
export type CyclesTransfer =
    | { Failed: FailedCyclesTransfer }
    | { Completed: CompletedCyclesTransfer }
    | { Pending: PendingCyclesTransfer };
export type CyclesWithdrawal =
    | { Failed: FailedCyclesWithdrawal }
    | { Completed: CompletedCyclesWithdrawal }
    | { Pending: PendingCyclesWithdrawal };
export interface DeleteMessagesArgs {
    user_id: UserId;
    message_ids: Array<MessageId>;
}
export type DeleteMessagesResponse = { ChatNotFound: null } | { Success: null };
export interface DeletedContent {
    timestamp: TimestampMillis;
    deleted_by: UserId;
}
export type DirectChatCreated = {};
export type DirectChatEvent =
    | { MessageReactionRemoved: UpdatedMessage }
    | { MessageReactionAdded: UpdatedMessage }
    | { Message: Message }
    | { MessageDeleted: UpdatedMessage }
    | { DirectChatCreated: DirectChatCreated }
    | { MessageEdited: UpdatedMessage };
export interface DirectChatEventWrapper {
    event: DirectChatEvent;
    timestamp: TimestampMillis;
    index: EventIndex;
}
export interface DirectChatSummary {
    date_created: TimestampMillis;
    them: UserId;
    notifications_muted: boolean;
    read_by_me: Array<MessageIndexRange>;
    latest_event_index: EventIndex;
    read_by_them: Array<MessageIndexRange>;
    latest_message: MessageEventWrapper;
}
export interface DirectChatSummaryUpdates {
    notifications_muted: [] | [boolean];
    read_by_me: [] | [Array<MessageIndexRange>];
    latest_event_index: [] | [EventIndex];
    chat_id: ChatId;
    read_by_them: [] | [Array<MessageIndexRange>];
    latest_message: [] | [MessageEventWrapper];
}
export interface DirectMessageNotification {
    sender: UserId;
    message: Message;
    sender_name: string;
}
export interface DismissAlertsArgs {
    alert_ids: Array<string>;
}
export type DismissAlertsResponse = { PartialSuccess: Array<string> } | { Success: null };
export interface EditMessageArgs {
    content: MessageContent;
    user_id: UserId;
    message_id: MessageId;
}
export type EditMessageResponse =
    | { MessageNotFound: null }
    | { ChatNotFound: null }
    | { Success: null }
    | { UserBlocked: null };
export type EventIndex = number;
export interface EventsArgs {
    user_id: UserId;
    max_messages: number;
    max_events: number;
    ascending: boolean;
    start_index: EventIndex;
}
export interface EventsByIndexArgs {
    user_id: UserId;
    events: Array<EventIndex>;
}
export interface EventsRangeArgs {
    user_id: UserId;
    to_index: EventIndex;
    from_index: EventIndex;
}
export type EventsResponse = { ChatNotFound: null } | { Success: EventsSuccessResult };
export interface EventsSuccessResult {
    affected_events: Array<DirectChatEventWrapper>;
    events: Array<DirectChatEventWrapper>;
}
export interface EventsWindowArgs {
    mid_point: MessageIndex;
    user_id: UserId;
    max_messages: number;
    max_events: number;
}
export interface FailedCyclesTransfer {
    error_message: string;
    recipient: UserId;
    cycles: Cycles;
}
export interface FailedCyclesWithdrawal {
    to: CanisterId;
    error_message: string;
    cycles: Cycles;
}
export interface FailedICPTransfer {
    memo: bigint;
    error_message: string;
    recipient: UserId;
    fee_e8s: bigint;
    amount_e8s: bigint;
}
export interface FailedICPWithdrawal {
    to: string;
    memo: bigint;
    error_message: string;
    fee_e8s: bigint;
    amount_e8s: bigint;
}
export type FallbackRole = { Participant: null } | { Admin: null };
export interface FieldTooLongResult {
    length_provided: number;
    max_length: number;
}
export interface FileContent {
    name: string;
    mime_type: string;
    file_size: number;
    blob_reference: [] | [BlobReference];
    caption: [] | [string];
}
export interface GroupChatCreated {
    name: string;
    description: string;
    created_by: UserId;
}
export type GroupChatEvent =
    | { MessageReactionRemoved: UpdatedMessage }
    | { ParticipantJoined: ParticipantJoined }
    | { ParticipantAssumesSuperAdmin: ParticipantAssumesSuperAdmin }
    | { GroupDescriptionChanged: GroupDescriptionChanged }
    | { GroupChatCreated: GroupChatCreated }
    | { ParticipantsPromotedToAdmin: ParticipantsPromotedToAdmin }
    | { UsersBlocked: UsersBlocked }
    | { MessageReactionAdded: UpdatedMessage }
    | { ParticipantsRemoved: ParticipantsRemoved }
    | { ParticipantRelinquishesSuperAdmin: ParticipantRelinquishesSuperAdmin }
    | { Message: Message }
    | { ParticipantsDismissedAsAdmin: ParticipantsDismissedAsAdmin }
    | { UsersUnblocked: UsersUnblocked }
    | { ParticipantLeft: ParticipantLeft }
    | { MessageDeleted: UpdatedMessage }
    | { ParticipantDismissedAsSuperAdmin: ParticipantDismissedAsSuperAdmin }
    | { GroupNameChanged: GroupNameChanged }
    | { OwnershipTransferred: OwnershipTransferred }
    | { MessageEdited: UpdatedMessage }
    | { AvatarChanged: AvatarChanged }
    | { ParticipantsAdded: ParticipantsAdded };
export interface GroupChatEventWrapper {
    event: GroupChatEvent;
    timestamp: TimestampMillis;
    index: EventIndex;
}
export interface GroupChatSummary {
    is_public: boolean;
    min_visible_event_index: EventIndex;
    name: string;
    role: Role;
    wasm_version: Version;
    notifications_muted: boolean;
    description: string;
    last_updated: TimestampMillis;
    read_by_me: Array<MessageIndexRange>;
    joined: TimestampMillis;
    avatar_id: [] | [bigint];
    latest_event_index: EventIndex;
    min_visible_message_index: MessageIndex;
    mentions: Array<Mention>;
    chat_id: ChatId;
    participant_count: number;
    latest_message: [] | [MessageEventWrapper];
}
export interface GroupChatSummaryUpdates {
    name: [] | [string];
    role: [] | [Role];
    wasm_version: [] | [Version];
    notifications_muted: [] | [boolean];
    description: [] | [string];
    last_updated: TimestampMillis;
    read_by_me: [] | [Array<MessageIndexRange>];
    avatar_id: [] | [bigint];
    latest_event_index: [] | [EventIndex];
    mentions: Array<Mention>;
    chat_id: ChatId;
    participant_count: [] | [number];
    latest_message: [] | [MessageEventWrapper];
}
export interface GroupChatUpdatesSince {
    updates_since: TimestampMillis;
    chat_id: ChatId;
}
export interface GroupDeletedAlert {
    deleted_by: UserId;
    chat_id: ChatId;
}
export interface GroupDescriptionChanged {
    new_description: string;
    previous_description: string;
    changed_by: UserId;
}
export interface GroupMessageNotification {
    sender: UserId;
    message: Message;
    sender_name: string;
    chat_id: ChatId;
    group_name: string;
}
export interface GroupNameChanged {
    changed_by: UserId;
    new_name: string;
    previous_name: string;
}
export type ICPDeposit = { Completed: CompletedICPDeposit };
export type ICPTransfer =
    | { Failed: FailedICPTransfer }
    | { Completed: CompletedICPTransfer }
    | { Pending: PendingICPTransfer };
export type ICPWithdrawal =
    | { Failed: FailedICPWithdrawal }
    | { Completed: CompletedICPWithdrawal }
    | { Pending: PendingICPWithdrawal };
export interface ImageContent {
    height: number;
    mime_type: string;
    blob_reference: [] | [BlobReference];
    thumbnail_data: string;
    caption: [] | [string];
    width: number;
}
export interface IndexedNotification {
    value: NotificationEnvelope;
    index: bigint;
}
export type InitialStateArgs = {};
export type InitialStateResponse =
    | {
          Success: {
              cycles_balance: Cycles;
              user_canister_wasm_version: Version;
              upgrades_in_progress: Array<ChatId>;
              chats: Array<ChatSummary>;
              blocked_users: Array<UserId>;
              timestamp: TimestampMillis;
              transactions: Array<TransactionWrapper>;
          };
      }
    | { InternalError: string };
export interface JoinGroupArgs {
    as_super_admin: boolean;
    chat_id: ChatId;
}
export type JoinGroupResponse =
    | { Blocked: null }
    | { GroupNotFound: null }
    | { GroupNotPublic: null }
    | { AlreadyInGroup: null }
    | { Success: null }
    | { NotSuperAdmin: null }
    | { ParticipantLimitReached: number }
    | { InternalError: string };
export interface LeaveGroupArgs {
    chat_id: ChatId;
}
export type LeaveGroupResponse =
    | { GroupNotFound: null }
    | { GroupNotPublic: null }
    | { OwnerCannotLeave: null }
    | { CallerNotInGroup: null }
    | { Success: null }
    | { InternalError: string };
export interface MarkReadArgs {
    messages_read: Array<ChatMessagesRead>;
}
export type MarkReadResponse = { Success: null };
export interface Mention {
    message_index: MessageIndex;
}
export interface Message {
    content: MessageContent;
    edited: boolean;
    sender: UserId;
    message_id: MessageId;
    replies_to: [] | [ReplyContext];
    reactions: Array<[string, Array<UserId>]>;
    message_index: MessageIndex;
}
export type MessageContent =
    | { File: FileContent }
    | { Text: TextContent }
    | { Image: ImageContent }
    | { Cryptocurrency: CryptocurrencyContent }
    | { Audio: AudioContent }
    | { Video: VideoContent }
    | { Deleted: DeletedContent };
export interface MessageEventWrapper {
    event: Message;
    timestamp: TimestampMillis;
    index: EventIndex;
}
export type MessageId = bigint;
export type MessageIndex = number;
export interface MessageIndexRange {
    to: MessageIndex;
    from: MessageIndex;
}
export interface MessageMatch {
    content: MessageContent;
    sender: UserId;
    score: number;
    chat_id: ChatId;
    message_index: MessageIndex;
}
export type Milliseconds = bigint;
export interface MuteNotificationsArgs {
    chat_id: ChatId;
}
export type MuteNotificationsResponse = { ChatNotFound: null } | { Success: null };
export type NightMode = { On: null } | { Off: null } | { Auto: null };
export type Notification =
    | {
          DirectMessageNotification: DirectMessageNotification;
      }
    | { GroupMessageNotification: GroupMessageNotification }
    | { AddedToGroupNotification: AddedToGroupNotification };
export interface NotificationEnvelope {
    notification: Notification;
    recipients: Array<UserId>;
}
export interface OptionalUserPreferences {
    large_emoji: [] | [boolean];
    notification_preferences:
        | []
        | [
              {
                  private_group_chats: [] | [boolean];
                  direct_chats: [] | [boolean];
                  silent: [] | [boolean];
                  public_group_chats: [] | [boolean];
                  vibrate: [] | [boolean];
              }
          ];
    night_mode: [] | [NightMode];
    language: [] | [string];
    enter_key_sends: [] | [boolean];
    generate_link_previews: [] | [boolean];
    use_system_emoji: [] | [boolean];
    enable_animations: [] | [boolean];
}
export interface OwnershipTransferred {
    old_owner: UserId;
    new_owner: UserId;
}
export interface PartialUserSummary {
    username: [] | [string];
    user_id: UserId;
    avatar_id: [] | [bigint];
    seconds_since_last_online: number;
}
export interface Participant {
    role: Role;
    user_id: UserId;
    date_added: TimestampMillis;
}
export interface ParticipantAssumesSuperAdmin {
    user_id: UserId;
}
export interface ParticipantDismissedAsSuperAdmin {
    user_id: UserId;
}
export interface ParticipantJoined {
    user_id: UserId;
    as_super_admin: boolean;
}
export interface ParticipantLeft {
    user_id: UserId;
}
export interface ParticipantRelinquishesSuperAdmin {
    user_id: UserId;
}
export interface ParticipantsAdded {
    user_ids: Array<UserId>;
    unblocked: Array<UserId>;
    added_by: UserId;
}
export interface ParticipantsDismissedAsAdmin {
    user_ids: Array<UserId>;
    dismissed_by: UserId;
}
export interface ParticipantsPromotedToAdmin {
    user_ids: Array<UserId>;
    promoted_by: UserId;
}
export interface ParticipantsRemoved {
    user_ids: Array<UserId>;
    removed_by: UserId;
}
export interface PendingCyclesTransfer {
    recipient: UserId;
    cycles: Cycles;
}
export interface PendingCyclesWithdrawal {
    to: CanisterId;
    cycles: Cycles;
}
export interface PendingICPTransfer {
    memo: [] | [bigint];
    recipient: UserId;
    fee_e8s: [] | [bigint];
    amount_e8s: bigint;
}
export interface PendingICPWithdrawal {
    to: string;
    memo: [] | [bigint];
    fee_e8s: [] | [bigint];
    amount_e8s: bigint;
}
export interface RelinquishGroupSuperAdminArgs {
    chat_id: ChatId;
}
export type RelinquishGroupSuperAdminResponse =
    | { CallerNotInGroup: null }
    | { Success: null }
    | { NotSuperAdmin: null }
    | { InternalError: string };
export interface RemovedFromGroupAlert {
    chat_id: ChatId;
    removed_by: UserId;
}
export interface ReplyContext {
    chat_id_if_other: [] | [ChatId];
    event_index: EventIndex;
}
export type Role =
    | { Participant: null }
    | { SuperAdmin: FallbackRole }
    | { Admin: null }
    | { Owner: null };
export interface SearchAllMessagesArgs {
    max_results: number;
    search_term: string;
}
export type SearchAllMessagesResponse =
    | { TermTooShort: number }
    | { Success: SearchMessagesSuccessResult }
    | { TermTooLong: number }
    | { InvalidTerm: null };
export interface SearchMessagesArgs {
    max_results: number;
    user_id: UserId;
    search_term: string;
}
export type SearchMessagesResponse =
    | { TermTooShort: number }
    | { ChatNotFound: null }
    | { Success: SearchMessagesSuccessResult }
    | { TermTooLong: number }
    | { InvalidTerm: null };
export interface SearchMessagesSuccessResult {
    matches: Array<MessageMatch>;
}
export interface SendMessageArgs {
    content: MessageContent;
    recipient: UserId;
    sender_name: string;
    message_id: MessageId;
    replies_to: [] | [ReplyContext];
}
export type SendMessageResponse =
    | { TextTooLong: number }
    | { TransactionFailed: string }
    | {
          Success: {
              timestamp: TimestampMillis;
              chat_id: ChatId;
              event_index: EventIndex;
              message_index: MessageIndex;
          };
      }
    | { MessageEmpty: null }
    | { RecipientBlocked: null }
    | { InvalidRequest: string };
export interface SetAvatarArgs {
    avatar: Avatar;
}
export type SetAvatarResponse = { AvatarTooBig: FieldTooLongResult } | { Success: bigint };
export interface SetPreferencesArgs {
    preferences: OptionalUserPreferences;
}
export type SetPreferencesResponse = { Success: null };
export interface Subscription {
    value: SubscriptionInfo;
    last_active: TimestampMillis;
}
export interface SubscriptionInfo {
    endpoint: string;
    keys: SubscriptionKeys;
}
export interface SubscriptionKeys {
    auth: string;
    p256dh: string;
}
export interface TextContent {
    text: string;
}
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface ToggleReactionArgs {
    user_id: UserId;
    message_id: MessageId;
    reaction: string;
}
export type ToggleReactionResponse =
    | { MessageNotFound: null }
    | { ChatNotFound: null }
    | { InvalidReaction: null }
    | { Added: EventIndex }
    | { Removed: EventIndex };
export type Transaction = { Cryptocurrency: CryptocurrencyTransaction };
export type TransactionStatus = { Failed: string } | { Complete: null } | { Pending: null };
export interface TransactionWrapper {
    transaction: Transaction;
    timestamp: TimestampMillis;
    index: number;
}
export interface TransactionsArgs {
    max_transactions: number;
    ascending: boolean;
    start_index: number;
}
export type TransactionsResponse = { Success: TransactionsSuccessResult };
export interface TransactionsSuccessResult {
    latest_transaction_index: [] | [number];
    transactions: Array<TransactionWrapper>;
}
export interface UnblockUserArgs {
    user_id: UserId;
}
export type UnblockUserResponse = { Success: null };
export interface UnmuteNotificationsArgs {
    chat_id: ChatId;
}
export type UnmuteNotificationsResponse = { ChatNotFound: null } | { Success: null };
export interface UpdatedMessage {
    updated_by: UserId;
    message_id: MessageId;
    event_index: EventIndex;
}
export interface UpdatesArgs {
    updates_since: UpdatesSince;
}
export type UpdatesResponse =
    | {
          Success: {
              cycles_balance: [] | [Cycles];
              user_canister_wasm_version: [] | [Version];
              upgrades_in_progress: Array<ChatId>;
              alerts: Array<Alert>;
              chats_updated: Array<ChatSummaryUpdates>;
              blocked_users: Array<UserId>;
              chats_added: Array<ChatSummary>;
              chats_removed: Array<ChatId>;
              timestamp: TimestampMillis;
              transactions: Array<TransactionWrapper>;
          };
      }
    | { InternalError: string };
export interface UpdatesSince {
    group_chats: Array<GroupChatUpdatesSince>;
    timestamp: TimestampMillis;
}
export type UserId = CanisterId;
export interface UserSummary {
    username: string;
    user_id: UserId;
    avatar_id: [] | [bigint];
    seconds_since_last_online: number;
}
export interface UsersBlocked {
    user_ids: Array<UserId>;
    blocked_by: UserId;
}
export interface UsersUnblocked {
    user_ids: Array<UserId>;
    unblocked_by: UserId;
}
export interface Version {
    major: number;
    minor: number;
    patch: number;
}
export interface VideoContent {
    height: number;
    image_blob_reference: [] | [BlobReference];
    video_blob_reference: [] | [BlobReference];
    mime_type: string;
    thumbnail_data: string;
    caption: [] | [string];
    width: number;
}
export interface _SERVICE {
    assume_group_super_admin: (
        arg_0: AssumeGroupSuperAdminArgs
    ) => Promise<AssumeGroupSuperAdminResponse>;
    block_user: (arg_0: BlockUserArgs) => Promise<BlockUserResponse>;
    create_group: (arg_0: CreateGroupArgs) => Promise<CreateGroupResponse>;
    delete_messages: (arg_0: DeleteMessagesArgs) => Promise<DeleteMessagesResponse>;
    dismiss_alerts: (arg_0: DismissAlertsArgs) => Promise<DismissAlertsResponse>;
    edit_message: (arg_0: EditMessageArgs) => Promise<EditMessageResponse>;
    events: (arg_0: EventsArgs) => Promise<EventsResponse>;
    events_by_index: (arg_0: EventsByIndexArgs) => Promise<EventsResponse>;
    events_range: (arg_0: EventsRangeArgs) => Promise<EventsResponse>;
    events_window: (arg_0: EventsWindowArgs) => Promise<EventsResponse>;
    initial_state: (arg_0: InitialStateArgs) => Promise<InitialStateResponse>;
    join_group: (arg_0: JoinGroupArgs) => Promise<JoinGroupResponse>;
    leave_group: (arg_0: LeaveGroupArgs) => Promise<LeaveGroupResponse>;
    mark_read: (arg_0: MarkReadArgs) => Promise<MarkReadResponse>;
    mute_notifications: (arg_0: MuteNotificationsArgs) => Promise<MuteNotificationsResponse>;
    relinquish_group_super_admin: (
        arg_0: RelinquishGroupSuperAdminArgs
    ) => Promise<RelinquishGroupSuperAdminResponse>;
    search_all_messages: (arg_0: SearchAllMessagesArgs) => Promise<SearchAllMessagesResponse>;
    search_messages: (arg_0: SearchMessagesArgs) => Promise<SearchMessagesResponse>;
    send_message: (arg_0: SendMessageArgs) => Promise<SendMessageResponse>;
    set_avatar: (arg_0: SetAvatarArgs) => Promise<SetAvatarResponse>;
    set_preferences: (arg_0: SetPreferencesArgs) => Promise<SetPreferencesResponse>;
    toggle_reaction: (arg_0: ToggleReactionArgs) => Promise<ToggleReactionResponse>;
    transactions: (arg_0: TransactionsArgs) => Promise<TransactionsResponse>;
    unblock_user: (arg_0: UnblockUserArgs) => Promise<UnblockUserResponse>;
    unmute_notifications: (arg_0: UnmuteNotificationsArgs) => Promise<UnmuteNotificationsResponse>;
    updates: (arg_0: UpdatesArgs) => Promise<UpdatesResponse>;
}
