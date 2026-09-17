use crate::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, ChatInternal, DeleteMessageSuccess,
    DeleteUndeleteMessagesArgs, EditMessageArgs, EditMessageSuccess, EventKey, EventPusher, MessageContentInternal,
    MessageInternal, PushEventResultInternal, PushMessageArgs, Reader, RemoveEventsResult, TipMessageArgs, UpdateEventError,
    UpdateMessageSuccess,
};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::cmp::min;
use std::collections::HashSet;
use types::{
    BotNotification, BotUpdated, ChatEventCategory, ChatEventType, DirectChatSummary, DirectChatSummaryUpdates, EventIndex,
    EventWrapper, Message, MessageId, MessageIndex, Milliseconds, OCResult, OptionUpdate, P2PSwapAccepted, P2PSwapCompleted,
    P2PSwapContent, P2PSwapStatus, ReserveP2PSwapSuccess, TimestampMillis, Timestamped, UserId, UserType, VideoCallPresence,
};

/// One user's copy of a direct chat. Each user of a chat holds their own copy, with its own events
/// (so its own event and message indexes) and its own record of how far each of them has read,
/// whether they are in different canisters or the same one.
#[derive(Serialize, Deserialize)]
#[serde(from = "DirectChatSerde")]
pub struct DirectChat {
    pub them: UserId,
    pub user_type: UserType,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
    date_created: TimestampMillis,
    // Only exposed via the methods below (there is deliberately no `events_mut`), so that a
    // message can only be pushed via `push_message`, which also updates the state kept alongside
    // the events
    events: ChatEvents,
    // Maps our message indexes onto theirs, which is needed because each user's copy of the chat
    // has its own message indexes. Private so that every message pushed goes through
    // `push_message`, which keeps it in step with the events.
    unread_message_index_map: UnreadMessageIndexMap,
    read_by_me_up_to: Timestamped<Option<MessageIndex>>,
    read_by_them_up_to: Timestamped<Option<MessageIndex>>,
    // Whether the chat is the user's chat with themselves, in which case the messages they send
    // are read by "them" too
    self_chat: bool,
}

impl DirectChat {
    pub fn new(
        my_user_id: UserId,
        them: UserId,
        user_type: UserType,
        key_id: u32,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChat {
        DirectChat {
            them,
            user_type,
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
            date_created: now,
            events: ChatEvents::new_direct_chat(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me_up_to: Timestamped::new(None, now),
            read_by_them_up_to: Timestamped::new(None, now),
            self_chat: my_user_id == them,
        }
    }

    // TODO: Remove this after next release
    pub(crate) fn mark_as_self_chat(&mut self) -> bool {
        if std::mem::replace(&mut self.self_chat, true) {
            false
        } else {
            self.align_self_chat_read_positions();
            true
        }
    }

    // In a chat with yourself every message is read on both sides as it is sent, but a chat
    // serialized before it was marked as a self chat only advanced one of the two read positions
    // per message, and the split shape kept both of a self chat's positions in its first slot
    // leaving the second unused. So on either being read, whichever position is further along
    // is taken for both.
    // TODO: Remove this after next release
    fn align_self_chat_read_positions(&mut self) {
        let furthest = if self.read_by_them_up_to.value > self.read_by_me_up_to.value {
            self.read_by_them_up_to.clone()
        } else {
            self.read_by_me_up_to.clone()
        };
        self.read_by_me_up_to = furthest.clone();
        self.read_by_them_up_to = furthest;
    }

    pub fn events(&self) -> &ChatEvents {
        &self.events
    }

    pub fn main_events_reader(&self) -> ChatEventsListReader<'_> {
        self.events.main_events_reader()
    }

    pub fn events_reader(&self, thread_root_message_index: Option<MessageIndex>) -> Option<ChatEventsListReader<'_>> {
        self.events
            .events_reader(EventIndex::default(), thread_root_message_index, None)
    }

    pub fn message_internal(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(MessageInternal, EventIndex)> {
        self.events
            .message_internal(EventIndex::default(), thread_root_message_index, event_key)
    }

    pub fn get_p2p_swap(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<P2PSwapContent> {
        self.events
            .get_p2p_swap(thread_root_message_index, message_id, EventIndex::default())
    }

    pub fn date_created(&self) -> TimestampMillis {
        self.date_created
    }

    pub fn has_updates_since(&self, since: TimestampMillis) -> bool {
        self.last_updated() > since
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.events.last_updated().unwrap_or_default(),
            self.read_by_me_up_to.timestamp,
            self.read_by_them_up_to.timestamp,
            self.notifications_muted.timestamp,
            self.archived.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn read_by_me_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        &self.read_by_me_up_to
    }

    pub fn read_by_them_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        &self.read_by_them_up_to
    }

    // Returns the highest index (in the other user's copy of the chat) of the messages they sent
    // which we have read, given the index we have read up to in our copy
    pub fn max_read_up_to_of_theirs(&self, read_up_to: MessageIndex) -> Option<MessageIndex> {
        self.unread_message_index_map
            .get_max_read_up_to_of_theirs(self.events.stable_memory_prefix(), &read_up_to)
    }

    // Every stable memory key prefix the chat writes under, so that its entries can be garbage
    // collected once it has been deleted. Each chat has a unique `key_id`, so if a new chat is
    // created with the same user before the job has run then its entries aren't removed with these.
    pub fn stable_memory_key_prefixes(&self) -> Vec<BaseKeyPrefix> {
        let events_prefix = self.events.stable_memory_prefix();
        let mut prefixes = self.events.all_stable_memory_key_prefixes();
        prefixes.push(crate::unread_message_index_map::prefix(events_prefix).into());
        prefixes
    }

    pub fn main_message_id_to_index(&self, message_id: MessageId) -> Option<MessageIndex> {
        self.main_events_reader()
            .message_internal(message_id.into())
            .map(|m| m.message_index)
    }

    pub fn main_message_index_to_id(&self, message_index: MessageIndex) -> Option<MessageId> {
        self.main_events_reader()
            .message_internal(message_index.into())
            .map(|m| m.message_id)
    }

    // The id of the thread root with the given index, for telling the other user's copy of the
    // chat which thread a message is in: message ids are the same in both users' copies while the
    // indexes are not. Fails if there is no such message.
    pub fn thread_root_message_id(&self, thread_root_message_index: Option<MessageIndex>) -> OCResult<Option<MessageId>> {
        thread_root_message_index
            .map(|i| {
                self.main_message_index_to_id(i)
                    .ok_or_else(|| OCErrorCode::ThreadNotFound.into())
            })
            .transpose()
    }

    // The inverse of `thread_root_message_id`, for a thread root id received from the other user's
    // copy of the chat
    pub fn thread_root_message_index(&self, thread_root_message_id: Option<MessageId>) -> OCResult<Option<MessageIndex>> {
        thread_root_message_id
            .map(|id| {
                self.main_message_id_to_index(id)
                    .ok_or_else(|| OCErrorCode::ThreadNotFound.into())
            })
            .transpose()
    }

    pub fn to_summary(&self, my_user_id: UserId) -> DirectChatSummary {
        let events_reader = self.main_events_reader();
        let events_ttl = self.events.get_events_time_to_live();

        DirectChatSummary {
            them: self.them,
            last_updated: self.last_updated(),
            latest_message: events_reader.latest_message_event(Some(my_user_id)),
            latest_event_index: events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: events_reader.latest_message_index(),
            date_created: self.date_created,
            read_by_me_up_to: self.read_by_me_up_to.value,
            read_by_them_up_to: self.read_by_them_up_to.value,
            notifications_muted: self.notifications_muted.value,
            metrics: self.events.metrics().hydrate(),
            my_metrics: self
                .events
                .user_metrics(&my_user_id, None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            archived: self.archived.value,
            events_ttl: events_ttl.value,
            events_ttl_last_updated: events_ttl.timestamp,
            video_call_in_progress: self.events.video_call_in_progress(Some(my_user_id)),
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user_id: UserId) -> DirectChatSummaryUpdates {
        let events_reader = self.main_events_reader();

        let has_new_events = events_reader.latest_event_timestamp().is_some_and(|ts| ts > updates_since);
        let latest_message = events_reader.latest_message_event_if_updated(updates_since, Some(my_user_id));
        let latest_event_index = if has_new_events { events_reader.latest_event_index() } else { None };
        let latest_message_index = if has_new_events { events_reader.latest_message_index() } else { None };
        let notifications_muted = self.notifications_muted.if_set_after(updates_since).copied();
        let metrics = if has_new_events { Some(self.events.metrics().hydrate()) } else { None };
        let events_ttl = self.events.get_events_time_to_live();
        let updated_events: Vec<_> = self
            .events
            .recently_updated_events(updates_since, usize::MAX)
            .into_iter()
            .map(|(_, e, ts)| (e, ts))
            .collect();

        DirectChatSummaryUpdates {
            chat_id: self.them.into(),
            last_updated: self.last_updated(),
            latest_message,
            latest_event_index,
            latest_message_index,
            read_by_me_up_to: self.read_by_me_up_to.if_set_after(updates_since).copied().flatten(),
            read_by_them_up_to: self.read_by_them_up_to.if_set_after(updates_since).copied().flatten(),
            notifications_muted,
            updated_events,
            metrics,
            my_metrics: self
                .events
                .user_metrics(&my_user_id, Some(updates_since))
                .map(|m| m.hydrate()),
            archived: self.archived.if_set_after(updates_since).copied(),
            events_ttl: events_ttl
                .if_set_after(updates_since)
                .copied()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            events_ttl_last_updated: (events_ttl.timestamp > updates_since).then_some(events_ttl.timestamp),
            video_call_in_progress: self.events.video_call_in_progress_updates(Some(my_user_id), updates_since),
        }
    }

    // Pushes the message and marks it as read by its sender. `their_message_index` is the index
    // the message has in the other user's copy of the chat, if it was sent by them.
    pub fn push_message<P: EventPusher>(
        &mut self,
        args: PushMessageArgs,
        their_message_index: Option<MessageIndex>,
        event_pusher: Option<P>,
    ) -> EventWrapper<Message> {
        let now = args.now;
        let sent_by_me = args.sender != self.them;
        let (message_event, _) = self.events.push_message(args, event_pusher);
        let message_index = message_event.event.message_index;

        // In a chat with yourself the sender is both users
        if sent_by_me || self.self_chat {
            self.mark_read_by_me_up_to(message_index, now);
        }
        if !sent_by_me {
            self.mark_read_by_them_up_to(message_index, now);
        }

        if let Some(their_message_index) = their_message_index {
            self.unread_message_index_map
                .add(self.events.stable_memory_prefix(), message_index, their_message_index);
        }

        message_event
    }

    // Moves the user's read position forward to `message_index`, capped at the latest message.
    // Returns whether it moved.
    pub fn mark_read_by_me_up_to(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        Self::mark_read_up_to(&self.events, &mut self.read_by_me_up_to, message_index, now)
    }

    // Records how far the other user has read, as relayed from their copy of the chat
    pub fn mark_read_by_them_up_to(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        Self::mark_read_up_to(&self.events, &mut self.read_by_them_up_to, message_index, now)
    }

    fn mark_read_up_to(
        events: &ChatEvents,
        read_up_to: &mut Timestamped<Option<MessageIndex>>,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> bool {
        if let Some(latest_message_index) = events.main_events_list().latest_message_index() {
            let message_index = min(message_index, latest_message_index);
            if read_up_to.value < Some(message_index) {
                *read_up_to = Timestamped::new(Some(message_index), now);
                return true;
            }
        }
        false
    }

    // Forgets the indexes of their messages up to and including `their_read_up_to` (in their copy
    // of the chat), once we have told them we have read up to there
    pub fn remove_unread_message_indexes_up_to(&mut self, their_read_up_to: MessageIndex) {
        self.unread_message_index_map
            .remove_up_to(self.events.stable_memory_prefix(), their_read_up_to);
    }

    // TODO: Remove this after next release
    pub fn migrate_unread_message_indexes_to_stable_memory(&mut self) -> usize {
        self.unread_message_index_map
            .migrate_to_stable_memory(self.events.stable_memory_prefix())
    }

    pub fn push_bot_updated_event(&mut self, event: BotUpdated, now: TimestampMillis) -> PushEventResultInternal {
        self.events
            .push_main_event(ChatEventInternal::BotUpdated(Box::new(event)), now)
    }

    pub fn edit_message<P: EventPusher>(
        &mut self,
        args: EditMessageArgs,
        event_pusher: Option<P>,
    ) -> OCResult<EditMessageSuccess> {
        self.events.edit_message(args, event_pusher)
    }

    pub fn delete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, OCResult<DeleteMessageSuccess>)> {
        self.events.delete_messages(args)
    }

    pub fn undelete_messages(
        &mut self,
        args: DeleteUndeleteMessagesArgs,
    ) -> Vec<(MessageId, OCResult<Option<BotNotification>>)> {
        self.events.undelete_messages(args)
    }

    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> Option<(MessageContentInternal, UserId)> {
        self.events
            .remove_deleted_message_content(thread_root_message_index, message_id, now)
    }

    pub fn add_reaction<P: EventPusher>(
        &mut self,
        args: AddRemoveReactionArgs,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess<MessageInternal>> {
        self.events.add_reaction(args, event_pusher)
    }

    pub fn remove_reaction(&mut self, args: AddRemoveReactionArgs) -> OCResult<UpdateMessageSuccess> {
        self.events.remove_reaction(args)
    }

    pub fn tip_message<P: EventPusher>(
        &mut self,
        args: TipMessageArgs,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess> {
        self.events.tip_message(args, EventIndex::default(), event_pusher)
    }

    pub fn mark_message_reminder_created_message_hidden(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        self.events.mark_message_reminder_created_message_hidden(message_index, now)
    }

    pub fn reserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> OCResult<ReserveP2PSwapSuccess> {
        self.events
            .reserve_p2p_swap(user_id, thread_root_message_index, message_id, EventIndex::default(), now)
    }

    pub fn unreserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        self.events
            .unreserve_p2p_swap(user_id, thread_root_message_index, message_id, now)
    }

    pub fn accept_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        token1_txn_in: u64,
        now: TimestampMillis,
    ) -> OCResult<UpdateMessageSuccess<P2PSwapAccepted>> {
        self.events
            .accept_p2p_swap(user_id, thread_root_message_index, message_id, token1_txn_in, now)
    }

    #[expect(clippy::too_many_arguments)]
    pub fn complete_p2p_swap<P: EventPusher>(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        token0_txn_out: u64,
        token1_txn_out: u64,
        now: TimestampMillis,
        event_pusher: P,
    ) -> OCResult<UpdateMessageSuccess<P2PSwapCompleted>> {
        self.events.complete_p2p_swap(
            user_id,
            thread_root_message_index,
            message_id,
            token0_txn_out,
            token1_txn_out,
            now,
            event_pusher,
        )
    }

    pub fn cancel_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> OCResult<UpdateMessageSuccess<u32>> {
        self.events
            .cancel_p2p_swap(user_id, thread_root_message_index, message_id, now)
    }

    pub fn set_p2p_swap_status(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        status: P2PSwapStatus,
        now: TimestampMillis,
    ) -> Result<UpdateMessageSuccess, UpdateEventError> {
        self.events
            .set_p2p_swap_status(thread_root_message_index, message_id, status, now)
    }

    pub fn mark_p2p_swap_expired(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> Result<UpdateMessageSuccess, UpdateEventError> {
        self.events.mark_p2p_swap_expired(thread_root_message_index, message_id, now)
    }

    pub fn set_video_call_presence(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        presence: VideoCallPresence,
        now: TimestampMillis,
    ) -> OCResult<UpdateMessageSuccess> {
        self.events
            .set_video_call_presence(user_id, message_id, presence, EventIndex::default(), now)
    }

    pub fn end_video_call<P: EventPusher>(
        &mut self,
        event_key: EventKey,
        now: TimestampMillis,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess> {
        self.events.end_video_call(event_key, now, event_pusher)
    }

    pub fn set_events_time_to_live(
        &mut self,
        user_id: UserId,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
    ) -> Option<PushEventResultInternal> {
        self.events.set_events_time_to_live(user_id, events_ttl, now)
    }

    pub fn remove_expired_events(&mut self, now: TimestampMillis) -> RemoveEventsResult {
        self.events.remove_expired_events(now)
    }

    pub fn subscribe_bot_to_events(
        &mut self,
        bot_id: UserId,
        event_types: HashSet<ChatEventType>,
        permitted_categories: &HashSet<ChatEventCategory>,
    ) {
        self.events.subscribe_bot_to_events(bot_id, event_types, permitted_categories)
    }

    pub fn skip_their_metrics(&mut self, my_user_id: UserId) {
        self.events.skip_their_metrics(my_user_id)
    }

    pub fn migrate_events_to_stable_memory(&mut self, max_count: usize) -> usize {
        self.events.migrate_to_stable_memory(max_count)
    }

    pub fn migrate_legacy_events_batch(&mut self) -> bool {
        self.events.migrate_legacy_events_batch()
    }

    // TODO: Remove this once every user canister has been migrated
    pub(crate) fn assign_key_id(&mut self, key_id: u32) -> bool {
        self.events.assign_direct_chat_key_id(key_id)
    }

    pub(crate) fn migrate_reply(
        &mut self,
        message_index: MessageIndex,
        old: ChatInternal,
        new: ChatInternal,
        now: TimestampMillis,
    ) {
        self.events.migrate_reply(message_index, old, new, now)
    }
}

// Reads a `DirectChat` in its current shape or in the one it was briefly serialized in between
// times, with the events and both read positions split out into a `core` (which may also have
// held `date_created`) and a `min_visible_event_index`, which is ignored. The current shape is
// also the one from before the split, plus `self_chat`, so User canisters running either of the
// versions deployed before this one can be upgraded from.
// TODO: Remove the legacy fields after next release
#[derive(Deserialize)]
struct DirectChatSerde {
    them: UserId,
    user_type: UserType,
    notifications_muted: Timestamped<bool>,
    archived: Timestamped<bool>,
    // Absent only for chats serialized with `date_created` on the core
    #[serde(default)]
    date_created: Option<TimestampMillis>,
    unread_message_index_map: UnreadMessageIndexMap,
    #[serde(default)]
    self_chat: bool,
    #[serde(default)]
    events: Option<ChatEvents>,
    #[serde(default)]
    read_by_me_up_to: Option<Timestamped<Option<MessageIndex>>>,
    #[serde(default)]
    read_by_them_up_to: Option<Timestamped<Option<MessageIndex>>>,
    #[serde(default)]
    core: Option<LegacyDirectChatCore>,
}

#[derive(Deserialize)]
struct LegacyDirectChatCore {
    #[serde(default)]
    date_created: TimestampMillis,
    events: ChatEvents,
    // Read up to by me, then by them
    read_up_to: [Timestamped<Option<MessageIndex>>; 2],
}

impl From<DirectChatSerde> for DirectChat {
    fn from(value: DirectChatSerde) -> Self {
        let (events, read_by_me_up_to, read_by_them_up_to, date_created) = match value.core {
            Some(core) => {
                let [read_by_me_up_to, read_by_them_up_to] = core.read_up_to;
                (
                    core.events,
                    read_by_me_up_to,
                    read_by_them_up_to,
                    value.date_created.unwrap_or(core.date_created),
                )
            }
            None => (
                value.events.expect("events"),
                value.read_by_me_up_to.expect("read_by_me_up_to"),
                value.read_by_them_up_to.expect("read_by_them_up_to"),
                value.date_created.expect("date_created"),
            ),
        };

        let mut chat = DirectChat {
            them: value.them,
            user_type: value.user_type,
            notifications_muted: value.notifications_muted,
            archived: value.archived,
            date_created,
            events,
            unread_message_index_map: value.unread_message_index_map,
            read_by_me_up_to,
            read_by_them_up_to,
            self_chat: value.self_chat,
        };
        if chat.self_chat {
            chat.align_self_chat_read_positions();
        }
        chat
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn messages_are_read_by_their_sender_and_read_positions_are_kept_per_user() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::User, 1, None, 123, 1);

        let event = chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);
        assert_eq!(event.event.message_index, 0.into());
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_me_up_to().timestamp, 100);
        assert_eq!(chat.read_by_them_up_to().value, None);

        let event = chat.push_message::<NullEventPusher>(message(them, 2, 200), Some(7.into()), None);
        assert_eq!(event.event.message_index, 1.into());
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, Some(1.into()));
        assert_eq!(chat.read_by_them_up_to().timestamp, 200);
        assert_eq!(chat.last_updated(), 200);

        assert!(chat.mark_read_by_me_up_to(1.into(), 300));
        assert_eq!(chat.read_by_me_up_to().value, Some(1.into()));
        assert_eq!(chat.last_updated(), 300);

        // The message they sent had index 7 in their copy of the chat
        assert_eq!(chat.max_read_up_to_of_theirs(1.into()), Some(7.into()));

        let summary = chat.to_summary(me);
        assert_eq!(summary.them, them);
        assert_eq!(summary.read_by_me_up_to, Some(1.into()));
        assert_eq!(summary.read_by_them_up_to, Some(1.into()));
        assert_eq!(summary.latest_message_index, Some(1.into()));
        assert_eq!(summary.date_created, 1);
    }

    #[test]
    fn read_positions_only_move_forwards_and_are_capped_at_the_latest_message() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::User, 1, None, 123, 1);
        assert!(!chat.mark_read_by_me_up_to(0.into(), 50), "no messages yet");

        chat.push_message::<NullEventPusher>(message(them, 1, 100), None, None);
        chat.push_message::<NullEventPusher>(message(them, 2, 110), None, None);

        assert!(chat.mark_read_by_me_up_to(0.into(), 200));
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert!(!chat.mark_read_by_me_up_to(0.into(), 210), "already read that far");
        assert_eq!(chat.read_by_me_up_to().timestamp, 200);
        assert!(chat.mark_read_by_me_up_to(10.into(), 220));
        assert_eq!(chat.read_by_me_up_to().value, Some(1.into()), "capped at the latest message");
        assert_eq!(chat.read_by_them_up_to().value, Some(1.into()));
        assert!(!chat.mark_read_by_them_up_to(1.into(), 230));
        assert_eq!(chat.last_updated(), 220);
    }

    #[test]
    fn messages_in_a_chat_with_yourself_are_read_on_both_sides() {
        init_stable_memory_map();
        let me = user(1);
        let mut chat = DirectChat::new(me, me, UserType::User, 1, None, 123, 1);

        chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, Some(0.into()));

        chat.push_message::<NullEventPusher>(message(me, 2, 200), None, None);
        assert!(!chat.mark_read_by_me_up_to(1.into(), 300), "already read on sending");
        assert!(!chat.mark_read_by_them_up_to(1.into(), 300));
    }

    #[test]
    fn a_self_chat_serialized_in_earlier_shapes_has_both_read_positions_aligned() {
        init_stable_memory_map();
        let me = user(1);
        let mut chat = DirectChat::new(me, me, UserType::User, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);
        chat.push_message::<NullEventPusher>(message(me, 2, 200), None, None);
        chat.push_message::<NullEventPusher>(message(me, 3, 300), None, None);

        // The split shape kept a self chat's live read position in the first slot, with the second
        // holding whatever it had before the chat was marked as a self chat, or nothing
        #[derive(Serialize)]
        struct SplitSelfChat<'a> {
            them: UserId,
            user_type: UserType,
            notifications_muted: &'a Timestamped<bool>,
            archived: &'a Timestamped<bool>,
            date_created: TimestampMillis,
            unread_message_index_map: &'a UnreadMessageIndexMap,
            min_visible_event_index: EventIndex,
            self_chat: bool,
            core: SplitSelfChatCore<'a>,
        }

        #[derive(Serialize)]
        struct SplitSelfChatCore<'a> {
            events: &'a ChatEvents,
            read_up_to: [Timestamped<Option<MessageIndex>>; 2],
        }

        let split = |second_slot: Timestamped<Option<MessageIndex>>| SplitSelfChat {
            them: me,
            user_type: UserType::User,
            notifications_muted: &chat.notifications_muted,
            archived: &chat.archived,
            date_created: 1,
            unread_message_index_map: &chat.unread_message_index_map,
            min_visible_event_index: EventIndex::default(),
            self_chat: true,
            core: SplitSelfChatCore {
                events: &chat.events,
                read_up_to: [Timestamped::new(Some(2.into()), 300), second_slot],
            },
        };
        for second_slot in [Timestamped::new(None, 1), Timestamped::new(Some(0.into()), 100)] {
            let deserialized: DirectChat =
                msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(split(second_slot)));
            assert!(deserialized.self_chat);
            assert_eq!(deserialized.read_by_me_up_to().value, Some(2.into()));
            assert_eq!(deserialized.read_by_them_up_to().value, Some(2.into()));
        }

        // Before a chat with yourself was marked as such, only the "them" position moved as each
        // message was sent, and the "me" position when the user marked the chat as read
        let mut unmarked = DirectChat {
            self_chat: false,
            read_by_me_up_to: Timestamped::new(Some(0.into()), 150),
            read_by_them_up_to: Timestamped::new(Some(2.into()), 300),
            ..msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat))
        };
        assert!(unmarked.mark_as_self_chat());
        assert_eq!(unmarked.read_by_me_up_to(), &Timestamped::new(Some(2.into()), 300));
        assert_eq!(unmarked.read_by_them_up_to(), &Timestamped::new(Some(2.into()), 300));
        assert!(!unmarked.mark_as_self_chat(), "already marked");
    }

    #[test]
    fn muting_or_archiving_counts_as_an_update() {
        init_stable_memory_map();
        let mut chat = DirectChat::new(user(1), user(2), UserType::User, 1, None, 123, 1);
        assert_eq!(chat.last_updated(), 1);

        chat.archived = Timestamped::new(true, 50);
        assert!(chat.has_updates_since(49));
        assert!(!chat.has_updates_since(50));

        chat.notifications_muted = Timestamped::new(true, 80);
        assert_eq!(chat.last_updated(), 80);
        assert_eq!(chat.to_summary_updates(60, user(1)).notifications_muted, Some(true));
        assert_eq!(chat.to_summary_updates(60, user(1)).archived, None);
    }

    #[test]
    fn thread_roots_are_translated_between_ids_and_indexes() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::User, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);

        assert_eq!(chat.thread_root_message_id(None).unwrap(), None);
        assert_eq!(chat.thread_root_message_index(None).unwrap(), None);
        assert_eq!(
            chat.thread_root_message_id(Some(0.into())).unwrap(),
            Some(MessageId::from(1u128))
        );
        assert_eq!(
            chat.thread_root_message_index(Some(MessageId::from(1u128))).unwrap(),
            Some(0.into())
        );
        assert!(chat.thread_root_message_id(Some(1.into())).is_err());
        assert!(chat.thread_root_message_index(Some(MessageId::from(2u128))).is_err());
    }

    #[test]
    fn chats_serialized_in_earlier_shapes_are_deserialized() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::Bot, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(them, 1, 100), None, None);
        chat.mark_read_by_me_up_to(0.into(), 150);
        chat.notifications_muted = Timestamped::new(true, 200);

        // The shape from before the events and read positions were split out into a core, which
        // is the current shape without `self_chat`
        #[derive(Serialize)]
        struct FlatDirectChat<'a> {
            them: UserId,
            date_created: TimestampMillis,
            events: &'a ChatEvents,
            unread_message_index_map: &'a UnreadMessageIndexMap,
            read_by_me_up_to: &'a Timestamped<Option<MessageIndex>>,
            read_by_them_up_to: &'a Timestamped<Option<MessageIndex>>,
            notifications_muted: &'a Timestamped<bool>,
            archived: &'a Timestamped<bool>,
            user_type: UserType,
        }

        let flat = FlatDirectChat {
            them,
            date_created: chat.date_created(),
            events: &chat.events,
            unread_message_index_map: &chat.unread_message_index_map,
            read_by_me_up_to: chat.read_by_me_up_to(),
            read_by_them_up_to: chat.read_by_them_up_to(),
            notifications_muted: &chat.notifications_muted,
            archived: &chat.archived,
            user_type: UserType::Bot,
        };

        // The shape from when the events and read positions were split out into a core, with
        // `date_created` either on the chat or on the core
        #[derive(Serialize)]
        struct SplitDirectChat<'a> {
            them: UserId,
            user_type: UserType,
            notifications_muted: &'a Timestamped<bool>,
            archived: &'a Timestamped<bool>,
            date_created: Option<TimestampMillis>,
            unread_message_index_map: &'a UnreadMessageIndexMap,
            min_visible_event_index: EventIndex,
            self_chat: bool,
            core: SplitCore<'a>,
        }

        #[derive(Serialize)]
        struct SplitCore<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            date_created: Option<TimestampMillis>,
            events: &'a ChatEvents,
            read_up_to: [&'a Timestamped<Option<MessageIndex>>; 2],
        }

        let split = |date_created_on_core: bool| SplitDirectChat {
            them,
            user_type: UserType::Bot,
            notifications_muted: &chat.notifications_muted,
            archived: &chat.archived,
            date_created: (!date_created_on_core).then_some(chat.date_created()),
            unread_message_index_map: &chat.unread_message_index_map,
            min_visible_event_index: EventIndex::default(),
            self_chat: false,
            core: SplitCore {
                date_created: date_created_on_core.then_some(chat.date_created()),
                events: &chat.events,
                read_up_to: [chat.read_by_me_up_to(), chat.read_by_them_up_to()],
            },
        };

        let from_flat: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&flat));
        let from_split: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(split(false)));
        let from_split_with_date_created_on_core: DirectChat =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(split(true)));
        let round_tripped: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat));

        for deserialized in [from_flat, from_split, from_split_with_date_created_on_core, round_tripped] {
            assert_eq!(deserialized.them, them);
            assert_eq!(deserialized.user_type, UserType::Bot);
            assert_eq!(deserialized.notifications_muted, chat.notifications_muted);
            assert_eq!(deserialized.archived, chat.archived);
            assert_eq!(deserialized.date_created(), 1);
            assert!(!deserialized.self_chat);
            assert_eq!(deserialized.read_by_me_up_to(), chat.read_by_me_up_to());
            assert_eq!(deserialized.read_by_them_up_to(), chat.read_by_them_up_to());
            assert_eq!(deserialized.last_updated(), chat.last_updated());
            assert_eq!(deserialized.main_events_reader().latest_message_index(), Some(0.into()));
        }
    }

    fn message(sender: UserId, message_id: u128, now: TimestampMillis) -> PushMessageArgs {
        PushMessageArgs {
            sender,
            thread_root_message_index: None,
            message_id: MessageId::from(message_id),
            content: MessageContentInternal::Text(TextContentInternal {
                text: "hello".to_string(),
            }),
            sender_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            now,
        }
    }

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
