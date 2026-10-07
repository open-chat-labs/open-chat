use crate::unread_message_index_map::UnreadMessageIndexMap;
use candid::Principal;
use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, ChatInternal, DeleteMessageSuccess,
    DeleteUndeleteMessagesArgs, EditMessageArgs, EditMessageSuccess, EventKey, EventPusher, MessageContentInternal,
    MessageInternal, PushEventResultInternal, PushMessageArgs, Reader, RemoveEventsResult, TipMessageArgs, UpdateEventError,
    UpdateMessageSuccess,
};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::cmp::{max, min};
use std::collections::HashSet;
use types::{
    BotNotification, BotUpdated, ChatEventCategory, ChatEventType, DirectChatSummary, DirectChatSummaryUpdates, EventIndex,
    EventWrapper, Message, MessageId, MessageIndex, Milliseconds, OCResult, OptionUpdate, P2PSwapAccepted, P2PSwapCompleted,
    P2PSwapContent, P2PSwapStatus, ReserveP2PSwapSuccess, TimestampMillis, Timestamped, UserId, UserIdAndPrincipal, UserType,
    VideoCallPresence,
};
use utils::migrated_user_ids::MigratedUserIds;

/// One user's copy of a direct chat. Each user of a chat holds their own copy, with its own events
/// (so its own event and message indexes) and its own record of how far each of them has read,
/// whether they are in different canisters or the same one.
#[derive(Serialize, Deserialize)]
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
    // The latest change to the events' TTL, by either user, which a change from the other user must
    // supersede to be applied
    events_ttl_latest_change: EventsTtlLatestChange,
    // When the chat was moved onto the other user's new id, after they were migrated to a MultiUser
    // canister. Clients first hear of the chat under that id then, so are sent it as a new chat.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    them_migrated_at: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum EventsTtlLatestChange {
    // The chat is from before the latest change was recorded, and its TTL hasn't changed since
    #[default]
    Unknown,
    NeverChanged,
    Changed(EventsTtlChange),
}

// A change to a direct chat's TTL, by the user who made it, at the time they gave it. Both copies
// of a chat record the same change, so they agree on which of two changes supersedes the other.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct EventsTtlChange {
    pub by: UserId,
    pub at: TimestampMillis,
}

impl EventsTtlChange {
    // The later change supersedes the other, with two changes made at the same time settled in
    // favour of whichever user's id has the lower bytes
    pub fn supersedes(&self, other: &EventsTtlChange) -> bool {
        self.at > other.at || (self.at == other.at && self.by.as_slice() < other.by.as_slice())
    }
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
            events_ttl_latest_change: EventsTtlLatestChange::NeverChanged,
            them_migrated_at: None,
        }
    }

    // Moves what the chat holds under the user's id onto their new id, once they are migrated to a
    // MultiUser canister: their metrics and, if the chat is with themselves, the other user
    pub(crate) fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        self.events.migrate_user_metrics(old_user_id, new_user_id);
        if self.them == old_user_id {
            self.them = new_user_id;
            self.events.set_direct_chat_user(new_user_id);
        }
    }

    // Moves the chat onto the other user's new id, once they are migrated to a MultiUser canister.
    // Their messages keep the id they were sent under.
    pub(crate) fn migrate_their_user_id(&mut self, new_user_id: UserId, now: TimestampMillis) {
        self.them = new_user_id;
        self.events.set_direct_chat_user(new_user_id);
        self.them_migrated_at = Some(now);
    }

    // The id unique to the chat which its stable memory keys are built from
    pub fn key_id(&self) -> u32 {
        self.events
            .stable_memory_prefix()
            .direct_chat_key_id()
            .expect("Every direct chat is keyed by its key_id")
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

    // Whether clients which last synced at `since` haven't heard of the chat under its current id
    pub fn added_since(&self, since: TimestampMillis) -> bool {
        self.date_created > since || self.them_migrated_at.is_some_and(|t| t > since)
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
            self.them_migrated_at.unwrap_or_default(),
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

    pub fn to_summary(&self, my_user: UserIdAndPrincipal) -> DirectChatSummary {
        let my_user_id = my_user.user_id;
        let events_reader = self.main_events_reader();
        let events_ttl = self.events.get_events_time_to_live();

        DirectChatSummary {
            them: self.them,
            last_updated: self.last_updated(),
            latest_message: events_reader.latest_message_event(Some(my_user)),
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

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user: UserIdAndPrincipal) -> DirectChatSummaryUpdates {
        let my_user_id = my_user.user_id;
        let events_reader = self.main_events_reader();

        let has_new_events = events_reader.latest_event_timestamp().is_some_and(|ts| ts > updates_since);
        let latest_message = events_reader.latest_message_event_if_updated(updates_since, Some(my_user));
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

    pub fn push_bot_updated_event(&mut self, event: BotUpdated, now: TimestampMillis) -> PushEventResultInternal {
        self.events
            .push_main_event(ChatEventInternal::BotUpdated(Box::new(event)), now)
    }

    pub fn edit_message<P: EventPusher>(
        &mut self,
        args: EditMessageArgs,
        migrated_user_ids: &MigratedUserIds,
        event_pusher: Option<P>,
    ) -> OCResult<EditMessageSuccess> {
        self.events.edit_message(args, migrated_user_ids, event_pusher)
    }

    pub fn delete_messages(
        &mut self,
        args: DeleteUndeleteMessagesArgs,
        migrated_user_ids: &MigratedUserIds,
    ) -> Vec<(MessageId, OCResult<DeleteMessageSuccess>)> {
        self.events.delete_messages(args, migrated_user_ids)
    }

    pub fn undelete_messages(
        &mut self,
        args: DeleteUndeleteMessagesArgs,
        migrated_user_ids: &MigratedUserIds,
    ) -> Vec<(MessageId, OCResult<Option<BotNotification>>)> {
        self.events.undelete_messages(args, migrated_user_ids)
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
        migrated_user_ids: &MigratedUserIds,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess<MessageInternal>> {
        self.events.add_reaction(args, migrated_user_ids, event_pusher)
    }

    pub fn remove_reaction(
        &mut self,
        args: AddRemoveReactionArgs,
        migrated_user_ids: &MigratedUserIds,
    ) -> OCResult<UpdateMessageSuccess> {
        self.events.remove_reaction(args, migrated_user_ids)
    }

    pub fn tip_message<P: EventPusher>(
        &mut self,
        args: TipMessageArgs,
        migrated_user_ids: &MigratedUserIds,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess> {
        self.events
            .tip_message(args, EventIndex::default(), migrated_user_ids, event_pusher)
    }

    pub fn mark_message_reminder_created_message_hidden(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        self.events.mark_message_reminder_created_message_hidden(message_index, now)
    }

    pub fn reserve_p2p_swap(
        &mut self,
        user_id: UserId,
        principal: Principal,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> OCResult<ReserveP2PSwapSuccess> {
        self.events.reserve_p2p_swap(
            user_id,
            principal,
            thread_root_message_index,
            message_id,
            EventIndex::default(),
            now,
        )
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
        migrated_user_ids: &MigratedUserIds,
    ) -> OCResult<UpdateMessageSuccess<u32>> {
        self.events
            .cancel_p2p_swap(user_id, thread_root_message_index, message_id, now, migrated_user_ids)
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

    pub fn events_ttl_latest_change(&self) -> EventsTtlLatestChange {
        self.events_ttl_latest_change
    }

    // Sets the TTL as changed by the user `user_id`, returning the time the change is given, to be
    // sent to the other user, or `None` if the TTL already had the value, in which case nothing is
    // changed. A change is never given an earlier time than the latest change, so that each copy's
    // latest change is the latest either copy has seen. A change made after applying the other
    // user's change is given a later time than theirs, since if both had the same time the
    // tie-break on user ids might settle in favour of theirs, though the user's change was made
    // after it.
    pub fn set_events_time_to_live(
        &mut self,
        user_id: UserId,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
    ) -> Option<TimestampMillis> {
        let changed_at = match self.events_ttl_latest_change {
            EventsTtlLatestChange::Changed(latest) if latest.by == user_id => max(now, latest.at),
            EventsTtlLatestChange::Changed(latest) => max(now, latest.at + 1),
            _ => now,
        };
        self.events.set_events_time_to_live(user_id, events_ttl, now)?;
        self.events_ttl_latest_change = EventsTtlLatestChange::Changed(EventsTtlChange {
            by: user_id,
            at: changed_at,
        });
        Some(changed_at)
    }

    // Applies the other user's change to the TTL, which they made at `changed_at`. Their change is
    // recorded as the latest even if the TTL already had the value, since it is in their copy.
    pub fn apply_their_events_time_to_live(
        &mut self,
        events_ttl: Option<Milliseconds>,
        changed_at: TimestampMillis,
        now: TimestampMillis,
    ) {
        self.events.set_events_time_to_live(self.them, events_ttl, now);
        self.events_ttl_latest_change = EventsTtlLatestChange::Changed(EventsTtlChange {
            by: self.them,
            at: changed_at,
        });
    }

    pub fn remove_expired_events(&mut self, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> RemoveEventsResult {
        self.events.remove_expired_events(migrated_user_ids, now)
    }

    pub fn subscribe_bot_to_events(
        &mut self,
        bot_id: UserId,
        event_types: HashSet<ChatEventType>,
        permitted_categories: &HashSet<ChatEventCategory>,
    ) {
        self.events.subscribe_bot_to_events(bot_id, event_types, permitted_categories)
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

        let summary = chat.to_summary(UserIdAndPrincipal::new(me, me.as_principal()));
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
    fn events_ttl_records_the_latest_change() {
        init_stable_memory_map();
        let mut chat = DirectChat::new(user(1), user(2), UserType::User, 1, None, 123, 1);
        assert_eq!(chat.events_ttl_latest_change(), EventsTtlLatestChange::NeverChanged);

        // Setting the TTL it already has changes nothing
        assert!(chat.set_events_time_to_live(user(1), None, 10).is_none());
        assert_eq!(chat.events_ttl_latest_change(), EventsTtlLatestChange::NeverChanged);

        assert_eq!(chat.set_events_time_to_live(user(1), Some(1000), 10), Some(10));
        assert_eq!(chat.events_ttl_latest_change(), changed(1, 10));

        // The other user's change, made at 20, is recorded with that time, even though it's applied
        // at 30 and the TTL already has the value
        chat.apply_their_events_time_to_live(Some(1000), 20, 30);
        assert_eq!(chat.events_ttl_latest_change(), changed(2, 20));

        let deserialized: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat));
        assert_eq!(deserialized.events_ttl_latest_change(), changed(2, 20));

        // A change made at the same time as the other user's, after applying it, is given a later time
        assert_eq!(chat.set_events_time_to_live(user(1), Some(2000), 20), Some(21));
        assert_eq!(chat.events_ttl_latest_change(), changed(1, 21));

        // Following the user's own change, a change is given the current time, but no earlier than
        // that change
        assert_eq!(chat.set_events_time_to_live(user(1), Some(3000), 20), Some(21));
        assert_eq!(chat.set_events_time_to_live(user(1), Some(4000), 50), Some(50));
    }

    fn changed(by: u8, at: TimestampMillis) -> EventsTtlLatestChange {
        EventsTtlLatestChange::Changed(EventsTtlChange { by: user(by), at })
    }

    #[test]
    fn later_ttl_change_supersedes_with_ties_settled_by_user_id() {
        let change = |by: u8, at| EventsTtlChange { by: user(by), at };

        assert!(change(2, 20).supersedes(&change(1, 10)));
        assert!(!change(1, 10).supersedes(&change(2, 20)));
        assert!(change(1, 10).supersedes(&change(2, 10)));
        assert!(!change(2, 10).supersedes(&change(1, 10)));
        assert!(!change(1, 10).supersedes(&change(1, 10)));
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
        assert_eq!(
            chat.to_summary_updates(60, UserIdAndPrincipal::new(user(1), user(1).as_principal()))
                .notifications_muted,
            Some(true)
        );
        assert_eq!(
            chat.to_summary_updates(60, UserIdAndPrincipal::new(user(1), user(1).as_principal()))
                .archived,
            None
        );
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
    fn chats_round_trip_through_msgpack() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::Bot, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(them, 1, 100), None, None);
        chat.mark_read_by_me_up_to(0.into(), 150);
        chat.notifications_muted = Timestamped::new(true, 200);

        let deserialized: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat));

        assert_eq!(deserialized.them, them);
        assert_eq!(deserialized.user_type, UserType::Bot);
        assert_eq!(deserialized.notifications_muted, chat.notifications_muted);
        assert_eq!(deserialized.archived, chat.archived);
        assert_eq!(deserialized.date_created(), 1);
        assert!(!deserialized.self_chat);
        assert_eq!(deserialized.read_by_me_up_to(), chat.read_by_me_up_to());
        assert_eq!(deserialized.read_by_them_up_to(), chat.read_by_them_up_to());
        assert_eq!(deserialized.events_ttl_latest_change(), EventsTtlLatestChange::NeverChanged);
        assert_eq!(deserialized.last_updated(), chat.last_updated());
        assert_eq!(deserialized.main_events_reader().latest_message_index(), Some(0.into()));
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
