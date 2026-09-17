use crate::direct_chat_core::{DirectChatCore, Participant};
use crate::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, ChatInternal, DeleteMessageSuccess,
    DeleteUndeleteMessagesArgs, EditMessageArgs, EditMessageSuccess, EventKey, EventPusher, MessageContentInternal,
    MessageInternal, PushEventResultInternal, PushMessageArgs, Reader, RemoveEventsResult, TipMessageArgs, UpdateEventError,
    UpdateMessageSuccess,
};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use stable_memory_map::BaseKeyPrefix;
use std::borrow::{Borrow, BorrowMut};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{
    BotNotification, BotUpdated, ChatEventCategory, ChatEventType, DirectChatSummary, DirectChatSummaryUpdates, EventIndex,
    EventWrapper, Message, MessageId, MessageIndex, Milliseconds, OCResult, OptionUpdate, P2PSwapAccepted, P2PSwapCompleted,
    P2PSwapStatus, ReserveP2PSwapSuccess, TimestampMillis, Timestamped, UserId, UserType, VideoCallPresence,
};

/// One user's own state for a direct chat: everything about the chat which is theirs alone rather
/// than shared with the other user.
#[derive(Serialize, Deserialize)]
pub struct DirectChatUserState {
    pub them: UserId,
    pub user_type: UserType,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
    // Maps our message indexes onto theirs, which is only needed while each user's canister holds
    // its own copy of the chat with its own message indexes. Private so that every message pushed
    // goes through `DirectChat::push_message`, which keeps it in step with the core.
    unread_message_index_map: UnreadMessageIndexMap,
    // The first of the core's events this user can see. Zero unless the user deleted the chat and
    // then got it back while the other user kept their side of it, in which case the events from
    // before are hidden from them (see `DirectChatCore::rejoin`). A User canister deletes the
    // events along with the chat, so there it is always zero.
    #[serde(default)]
    min_visible_event_index: EventIndex,
}

impl DirectChatUserState {
    pub fn new(them: UserId, user_type: UserType, now: TimestampMillis) -> DirectChatUserState {
        Self::new_with_min_visible_event_index(them, user_type, EventIndex::default(), now)
    }

    // The state for a user getting a chat back after deleting it, whose view of the events starts
    // at `min_visible_event_index` (see `DirectChatCores::rejoin`)
    pub(crate) fn new_with_min_visible_event_index(
        them: UserId,
        user_type: UserType,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> DirectChatUserState {
        DirectChatUserState {
            them,
            user_type,
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            min_visible_event_index,
        }
    }
}

/// A direct chat as seen by one of its users: their own state for the chat together with its core.
///
/// The type parameters are how the two parts are held. A User canister holds a chat outright, as a
/// `DirectChat`, and its user is the core's first participant. A canister which holds both users
/// of a chat keeps each user's state and the shared core separately, and views them together as a
/// `DirectChatRef` or `DirectChatMut` for the duration of a call. The methods are the same however
/// the parts are held, and the user's state is reachable directly through `Deref`.
pub struct DirectChat<S = DirectChatUserState, C = DirectChatCore> {
    // The user's position in the core
    me: Participant,
    state: S,
    core: C,
}

pub type DirectChatRef<'a> = DirectChat<&'a DirectChatUserState, &'a DirectChatCore>;
pub type DirectChatMut<'a> = DirectChat<&'a mut DirectChatUserState, &'a mut DirectChatCore>;

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
            me: Participant::First,
            state: DirectChatUserState::new(them, user_type, now),
            core: DirectChatCore::new(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now),
        }
    }
}

// The borrowed forms are built by `DirectChatCores`, which holds the cores, so that a core is only
// ever reached through a view from one user's side
impl<'a> DirectChatRef<'a> {
    pub(crate) fn borrowed(me: Participant, state: &'a DirectChatUserState, core: &'a DirectChatCore) -> DirectChatRef<'a> {
        DirectChat { me, state, core }
    }
}

impl<'a> DirectChatMut<'a> {
    pub(crate) fn borrowed_mut(
        me: Participant,
        state: &'a mut DirectChatUserState,
        core: &'a mut DirectChatCore,
    ) -> DirectChatMut<'a> {
        DirectChat { me, state, core }
    }
}

impl<S: Borrow<DirectChatUserState>, C: Borrow<DirectChatCore>> DirectChat<S, C> {
    fn state(&self) -> &DirectChatUserState {
        self.state.borrow()
    }

    fn core(&self) -> &DirectChatCore {
        self.core.borrow()
    }

    pub fn events(&self) -> &ChatEvents {
        &self.core().events
    }

    pub fn min_visible_event_index(&self) -> EventIndex {
        self.state().min_visible_event_index
    }

    // Readers over the events this user can see. Prefer these to building a reader from `events()`
    // directly, which would not hide the events from before the user's view of the chat starts.
    pub fn main_events_reader(&self) -> ChatEventsListReader<'_> {
        self.events().visible_main_events_reader(self.min_visible_event_index())
    }

    pub fn events_reader(&self, thread_root_message_index: Option<MessageIndex>) -> Option<ChatEventsListReader<'_>> {
        self.events()
            .events_reader(self.min_visible_event_index(), thread_root_message_index, None)
    }

    pub fn date_created(&self) -> TimestampMillis {
        self.core().date_created
    }

    pub fn has_updates_since(&self, since: TimestampMillis) -> bool {
        self.last_updated() > since
    }

    pub fn last_updated(&self) -> TimestampMillis {
        let state = self.state();
        [
            self.core().last_updated(),
            state.notifications_muted.timestamp,
            state.archived.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn read_by_me_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        self.core().read_up_to(self.me)
    }

    pub fn read_by_them_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        self.core().read_up_to(self.me.other())
    }

    // Returns the highest index (in the other user's copy of the chat) of the messages they sent
    // which we have read, given the index we have read up to in our copy
    pub fn max_read_up_to_of_theirs(&self, read_up_to: MessageIndex) -> Option<MessageIndex> {
        self.state()
            .unread_message_index_map
            .get_max_read_up_to_of_theirs(self.core().events.stable_memory_prefix(), &read_up_to)
    }

    // Every stable memory key prefix the chat writes under, so that its entries can be garbage
    // collected once it has been deleted
    pub fn stable_memory_key_prefixes(&self) -> Vec<BaseKeyPrefix> {
        self.core().stable_memory_key_prefixes()
    }

    pub fn main_message_id_to_index(&self, message_id: MessageId) -> MessageIndex {
        self.core().main_message_id_to_index(message_id)
    }

    pub fn main_message_index_to_id(&self, message_index: MessageIndex) -> MessageId {
        self.core().main_message_index_to_id(message_index)
    }

    pub fn to_summary(&self, my_user_id: UserId) -> DirectChatSummary {
        let state = self.state();
        let events = &self.core().events;
        let events_reader = self.main_events_reader();
        let events_ttl = events.get_events_time_to_live();

        DirectChatSummary {
            them: state.them,
            last_updated: self.last_updated(),
            latest_message: events_reader.latest_message_event(Some(my_user_id)),
            latest_event_index: events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: events_reader.latest_message_index(),
            date_created: self.core().date_created,
            read_by_me_up_to: self.read_by_me_up_to().value,
            read_by_them_up_to: self.read_by_them_up_to().value,
            notifications_muted: state.notifications_muted.value,
            metrics: events.metrics().hydrate(),
            my_metrics: events
                .user_metrics(&my_user_id, None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            archived: state.archived.value,
            events_ttl: events_ttl.value,
            events_ttl_last_updated: events_ttl.timestamp,
            video_call_in_progress: events.video_call_in_progress(Some(my_user_id)),
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user_id: UserId) -> DirectChatSummaryUpdates {
        let state = self.state();
        let events = &self.core().events;
        let events_reader = self.main_events_reader();
        let min_visible_event_index = state.min_visible_event_index;

        let has_new_events = events_reader.latest_event_timestamp().is_some_and(|ts| ts > updates_since);
        let latest_message = events_reader.latest_message_event_if_updated(updates_since, Some(my_user_id));
        let latest_event_index = if has_new_events { events_reader.latest_event_index() } else { None };
        let latest_message_index = if has_new_events { events_reader.latest_message_index() } else { None };
        let notifications_muted = state.notifications_muted.if_set_after(updates_since).copied();
        let metrics = if has_new_events { Some(events.metrics().hydrate()) } else { None };
        let events_ttl = events.get_events_time_to_live();
        let updated_events: Vec<_> = events
            .recently_updated_events(updates_since, usize::MAX)
            .into_iter()
            // Events in the main chat from before the user's view of it starts are hidden from them
            .filter(|(thread_root_message_index, e, _)| thread_root_message_index.is_some() || *e >= min_visible_event_index)
            .map(|(_, e, ts)| (e, ts))
            .collect();

        DirectChatSummaryUpdates {
            chat_id: state.them.into(),
            last_updated: self.last_updated(),
            latest_message,
            latest_event_index,
            latest_message_index,
            read_by_me_up_to: self.read_by_me_up_to().if_set_after(updates_since).copied().flatten(),
            read_by_them_up_to: self.read_by_them_up_to().if_set_after(updates_since).copied().flatten(),
            notifications_muted,
            updated_events,
            metrics,
            my_metrics: events.user_metrics(&my_user_id, Some(updates_since)).map(|m| m.hydrate()),
            archived: state.archived.if_set_after(updates_since).copied(),
            events_ttl: events_ttl
                .if_set_after(updates_since)
                .copied()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            events_ttl_last_updated: (events_ttl.timestamp > updates_since).then_some(events_ttl.timestamp),
            video_call_in_progress: events.video_call_in_progress_updates(Some(my_user_id), updates_since),
        }
    }
}

impl<S: BorrowMut<DirectChatUserState>, C: BorrowMut<DirectChatCore>> DirectChat<S, C> {
    fn core_mut(&mut self) -> &mut DirectChatCore {
        self.core.borrow_mut()
    }

    // Both parts borrowed at once, for the operations which update the user's state from the core
    fn parts_mut(&mut self) -> (&mut DirectChatUserState, &mut DirectChatCore) {
        (self.state.borrow_mut(), self.core.borrow_mut())
    }

    // `their_message_index` is the index the message has in the other user's copy of the chat, if
    // it was sent by them
    pub fn push_message<P: EventPusher>(
        &mut self,
        args: PushMessageArgs,
        their_message_index: Option<MessageIndex>,
        event_pusher: Option<P>,
    ) -> EventWrapper<Message> {
        let sender = if args.sender != self.state().them { self.me } else { self.me.other() };
        let (state, core) = self.parts_mut();
        let message_event = core.push_message(args, sender, event_pusher);

        if let Some(their_message_index) = their_message_index {
            state.unread_message_index_map.add(
                core.events.stable_memory_prefix(),
                message_event.event.message_index,
                their_message_index,
            );
        }

        message_event
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, me: bool, now: TimestampMillis) -> bool {
        let participant = if me { self.me } else { self.me.other() };
        self.core_mut().mark_read_up_to(participant, message_index, now)
    }

    // Forgets the indexes of their messages up to and including `their_read_up_to` (in their copy
    // of the chat), once we have told them we have read up to there
    pub fn remove_unread_message_indexes_up_to(&mut self, their_read_up_to: MessageIndex) {
        let (state, core) = self.parts_mut();
        state
            .unread_message_index_map
            .remove_up_to(core.events.stable_memory_prefix(), their_read_up_to);
    }

    // TODO: Remove this after next release
    pub fn migrate_unread_message_indexes_to_stable_memory(&mut self) -> usize {
        let (state, core) = self.parts_mut();
        state
            .unread_message_index_map
            .migrate_to_stable_memory(core.events.stable_memory_prefix())
    }

    // The events are only exposed mutably via the methods below (there is deliberately no
    // `events_mut`), so that a message can only be pushed via `push_message`, which also updates the
    // state this struct keeps alongside the events.

    pub fn push_bot_updated_event(&mut self, event: BotUpdated, now: TimestampMillis) -> PushEventResultInternal {
        self.core_mut()
            .events
            .push_main_event(ChatEventInternal::BotUpdated(Box::new(event)), now)
    }

    pub fn edit_message<P: EventPusher>(
        &mut self,
        args: EditMessageArgs,
        event_pusher: Option<P>,
    ) -> OCResult<EditMessageSuccess> {
        self.core_mut().events.edit_message(args, event_pusher)
    }

    pub fn delete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, OCResult<DeleteMessageSuccess>)> {
        self.core_mut().events.delete_messages(args)
    }

    pub fn undelete_messages(
        &mut self,
        args: DeleteUndeleteMessagesArgs,
    ) -> Vec<(MessageId, OCResult<Option<BotNotification>>)> {
        self.core_mut().events.undelete_messages(args)
    }

    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> Option<(MessageContentInternal, UserId)> {
        self.core_mut()
            .events
            .remove_deleted_message_content(thread_root_message_index, message_id, now)
    }

    pub fn add_reaction<P: EventPusher>(
        &mut self,
        args: AddRemoveReactionArgs,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess<MessageInternal>> {
        self.core_mut().events.add_reaction(args, event_pusher)
    }

    pub fn remove_reaction(&mut self, args: AddRemoveReactionArgs) -> OCResult<UpdateMessageSuccess> {
        self.core_mut().events.remove_reaction(args)
    }

    pub fn tip_message<P: EventPusher>(
        &mut self,
        args: TipMessageArgs,
        min_visible_event_index: EventIndex,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess> {
        self.core_mut()
            .events
            .tip_message(args, min_visible_event_index, event_pusher)
    }

    pub fn mark_message_reminder_created_message_hidden(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        self.core_mut()
            .events
            .mark_message_reminder_created_message_hidden(message_index, now)
    }

    pub fn reserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> OCResult<ReserveP2PSwapSuccess> {
        self.core_mut()
            .events
            .reserve_p2p_swap(user_id, thread_root_message_index, message_id, min_visible_event_index, now)
    }

    pub fn unreserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        self.core_mut()
            .events
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
        self.core_mut()
            .events
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
        self.core_mut().events.complete_p2p_swap(
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
        self.core_mut()
            .events
            .cancel_p2p_swap(user_id, thread_root_message_index, message_id, now)
    }

    pub fn set_p2p_swap_status(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        status: P2PSwapStatus,
        now: TimestampMillis,
    ) -> Result<UpdateMessageSuccess, UpdateEventError> {
        self.core_mut()
            .events
            .set_p2p_swap_status(thread_root_message_index, message_id, status, now)
    }

    pub fn mark_p2p_swap_expired(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> Result<UpdateMessageSuccess, UpdateEventError> {
        self.core_mut()
            .events
            .mark_p2p_swap_expired(thread_root_message_index, message_id, now)
    }

    pub fn set_video_call_presence(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        presence: VideoCallPresence,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> OCResult<UpdateMessageSuccess> {
        self.core_mut()
            .events
            .set_video_call_presence(user_id, message_id, presence, min_visible_event_index, now)
    }

    pub fn end_video_call<P: EventPusher>(
        &mut self,
        event_key: EventKey,
        now: TimestampMillis,
        event_pusher: Option<P>,
    ) -> OCResult<UpdateMessageSuccess> {
        self.core_mut().events.end_video_call(event_key, now, event_pusher)
    }

    pub fn set_events_time_to_live(
        &mut self,
        user_id: UserId,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
    ) -> Option<PushEventResultInternal> {
        self.core_mut().events.set_events_time_to_live(user_id, events_ttl, now)
    }

    pub fn remove_expired_events(&mut self, now: TimestampMillis) -> RemoveEventsResult {
        self.core_mut().events.remove_expired_events(now)
    }

    pub fn subscribe_bot_to_events(
        &mut self,
        bot_id: UserId,
        event_types: HashSet<ChatEventType>,
        permitted_categories: &HashSet<ChatEventCategory>,
    ) {
        self.core_mut()
            .events
            .subscribe_bot_to_events(bot_id, event_types, permitted_categories)
    }

    pub fn skip_their_metrics(&mut self, my_user_id: UserId) {
        self.core_mut().events.skip_their_metrics(my_user_id)
    }

    pub fn migrate_events_to_stable_memory(&mut self, max_count: usize) -> usize {
        self.core_mut().events.migrate_to_stable_memory(max_count)
    }

    pub fn migrate_legacy_events_batch(&mut self) -> bool {
        self.core_mut().events.migrate_legacy_events_batch()
    }

    // TODO: Remove this once every user canister has been migrated
    pub(crate) fn assign_key_id(&mut self, key_id: u32) -> bool {
        self.core_mut().events.assign_direct_chat_key_id(key_id)
    }

    pub(crate) fn migrate_reply(
        &mut self,
        message_index: MessageIndex,
        old: ChatInternal,
        new: ChatInternal,
        now: TimestampMillis,
    ) {
        self.core_mut().events.migrate_reply(message_index, old, new, now)
    }
}

impl<S: Borrow<DirectChatUserState>, C> Deref for DirectChat<S, C> {
    type Target = DirectChatUserState;

    fn deref(&self) -> &DirectChatUserState {
        self.state.borrow()
    }
}

impl<S: BorrowMut<DirectChatUserState>, C> DerefMut for DirectChat<S, C> {
    fn deref_mut(&mut self) -> &mut DirectChatUserState {
        self.state.borrow_mut()
    }
}

// The owned form is serialized flat, with the fields of the user's state directly on the chat
// alongside the core, which is the shape User canisters hold their chats in. The user's position
// is not stored since in a User canister it is always the first.
impl Serialize for DirectChat {
    fn serialize<Ser: Serializer>(&self, serializer: Ser) -> Result<Ser::Ok, Ser::Error> {
        #[derive(Serialize)]
        struct SerializedDirectChat<'a> {
            them: &'a UserId,
            user_type: &'a UserType,
            notifications_muted: &'a Timestamped<bool>,
            archived: &'a Timestamped<bool>,
            unread_message_index_map: &'a UnreadMessageIndexMap,
            min_visible_event_index: EventIndex,
            core: &'a DirectChatCore,
        }

        SerializedDirectChat {
            them: &self.state.them,
            user_type: &self.state.user_type,
            notifications_muted: &self.state.notifications_muted,
            archived: &self.state.archived,
            unread_message_index_map: &self.state.unread_message_index_map,
            min_visible_event_index: self.state.min_visible_event_index,
            core: &self.core,
        }
        .serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for DirectChat {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<DirectChat, D::Error> {
        DirectChatSerde::deserialize(deserializer).map(DirectChat::from)
    }
}

// Reads a `DirectChat` in either its current shape or the shape from before the core was split out,
// in which the core's fields sat directly on the chat.
// TODO: Remove the legacy fields after next release
#[derive(Deserialize)]
struct DirectChatSerde {
    them: UserId,
    user_type: UserType,
    notifications_muted: Timestamped<bool>,
    archived: Timestamped<bool>,
    unread_message_index_map: UnreadMessageIndexMap,
    #[serde(default)]
    min_visible_event_index: EventIndex,
    #[serde(default)]
    core: Option<DirectChatCore>,
    #[serde(default)]
    date_created: Option<TimestampMillis>,
    #[serde(default)]
    events: Option<ChatEvents>,
    #[serde(default)]
    read_by_me_up_to: Option<Timestamped<Option<MessageIndex>>>,
    #[serde(default)]
    read_by_them_up_to: Option<Timestamped<Option<MessageIndex>>>,
}

impl From<DirectChatSerde> for DirectChat {
    fn from(value: DirectChatSerde) -> Self {
        let core = value.core.unwrap_or_else(|| {
            DirectChatCore::from_parts(
                value.date_created.expect("date_created"),
                value.events.expect("events"),
                value.read_by_me_up_to.expect("read_by_me_up_to"),
                value.read_by_them_up_to.expect("read_by_them_up_to"),
            )
        });

        DirectChat {
            me: Participant::First,
            state: DirectChatUserState {
                them: value.them,
                user_type: value.user_type,
                notifications_muted: value.notifications_muted,
                archived: value.archived,
                unread_message_index_map: value.unread_message_index_map,
                min_visible_event_index: value.min_visible_event_index,
            },
            core,
        }
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

        chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, None);

        chat.push_message::<NullEventPusher>(message(them, 2, 200), Some(7.into()), None);
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, Some(1.into()));

        assert!(chat.mark_read_up_to(1.into(), true, 300));
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
    fn two_users_sharing_one_core_each_see_the_chat_from_their_own_side() {
        init_stable_memory_map();
        let a = user(1);
        let b = user(2);
        let mut core = DirectChatCore::new_shared(b, 1, None, 123, 1);
        let mut a_state = DirectChatUserState::new(b, UserType::User, 1);
        let mut b_state = DirectChatUserState::new(a, UserType::User, 1);

        DirectChat::borrowed_mut(Participant::First, &mut a_state, &mut core).push_message::<NullEventPusher>(
            message(a, 1, 100),
            None,
            None,
        );

        let b_view = DirectChat::borrowed(Participant::Second, &b_state, &core);
        assert_eq!(b_view.them, a);
        assert_eq!(b_view.read_by_me_up_to().value, None);
        assert_eq!(b_view.read_by_them_up_to().value, Some(0.into()));
        let b_summary = b_view.to_summary(b);
        assert_eq!(b_summary.them, a);
        assert_eq!(b_summary.read_by_me_up_to, None);
        assert_eq!(b_summary.read_by_them_up_to, Some(0.into()));
        assert_eq!(b_summary.latest_message.unwrap().event.sender, a);

        // B's reply is read by B, and A sees it from the other side
        DirectChat::borrowed_mut(Participant::Second, &mut b_state, &mut core).push_message::<NullEventPusher>(
            message(b, 2, 200),
            None,
            None,
        );

        let a_view = DirectChat::borrowed(Participant::First, &a_state, &core);
        assert_eq!(a_view.them, b);
        assert_eq!(a_view.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(a_view.read_by_them_up_to().value, Some(1.into()));
        assert_eq!(a_view.to_summary(a).latest_message_index, Some(1.into()));

        // Each user's own state only affects their own view
        a_state.notifications_muted = Timestamped::new(true, 300);
        assert_eq!(DirectChat::borrowed(Participant::First, &a_state, &core).last_updated(), 300);
        assert_eq!(DirectChat::borrowed(Participant::Second, &b_state, &core).last_updated(), 200);
    }

    #[test]
    fn a_user_who_gets_a_chat_back_after_deleting_it_only_sees_the_events_from_then_on() {
        init_stable_memory_map();
        let a = user(1);
        let b = user(2);
        let mut core = DirectChatCore::new_shared(b, 1, None, 123, 1);
        let mut a_state = DirectChatUserState::new(b, UserType::User, 1);
        let mut b_state = DirectChatUserState::new(a, UserType::User, 1);

        DirectChat::borrowed_mut(Participant::First, &mut a_state, &mut core).push_message::<NullEventPusher>(
            message(a, 1, 100),
            None,
            None,
        );
        DirectChat::borrowed_mut(Participant::Second, &mut b_state, &mut core).push_message::<NullEventPusher>(
            message(b, 2, 200),
            None,
            None,
        );

        // B deletes their side of the chat, then A's next message brings it back for them
        drop(b_state);
        let min_visible_event_index = core.rejoin(Participant::Second, 300);
        let b_state = DirectChatUserState::new_with_min_visible_event_index(a, UserType::User, min_visible_event_index, 300);
        DirectChat::borrowed_mut(Participant::First, &mut a_state, &mut core).push_message::<NullEventPusher>(
            message(a, 3, 300),
            None,
            None,
        );

        let b_view = DirectChat::borrowed(Participant::Second, &b_state, &core);
        assert_eq!(b_view.min_visible_event_index(), 3.into());
        assert!(b_view.main_events_reader().get(EventIndex::from(1).into()).is_none());
        assert!(b_view.main_events_reader().get(EventIndex::from(3).into()).is_some());
        assert!(b_view.events_reader(None).unwrap().get(EventIndex::from(2).into()).is_none());

        let b_summary = b_view.to_summary(b);
        assert_eq!(b_summary.latest_message.unwrap().event.message_index, 2.into());
        assert_eq!(b_summary.latest_event_index, 3.into());
        assert_eq!(
            b_summary.read_by_me_up_to,
            Some(1.into()),
            "the hidden messages count as read"
        );
        assert!(
            b_view
                .to_summary_updates(50, b)
                .updated_events
                .iter()
                .all(|(e, _)| *e >= 3.into())
        );

        // A still sees everything
        let a_view = DirectChat::borrowed(Participant::First, &a_state, &core);
        assert_eq!(a_view.min_visible_event_index(), 0.into());
        assert!(a_view.main_events_reader().get(EventIndex::from(1).into()).is_some());
        assert_eq!(a_view.to_summary(a).read_by_them_up_to, Some(1.into()));
    }

    #[test]
    fn chats_serialized_before_the_core_was_split_out_are_deserialized() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::Bot, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(them, 1, 100), None, None);
        chat.mark_read_up_to(0.into(), true, 150);
        chat.notifications_muted = Timestamped::new(true, 200);

        // The shape `DirectChat` was serialized in with the core's fields directly on the chat
        #[derive(Serialize)]
        struct LegacyDirectChat<'a> {
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

        let legacy = LegacyDirectChat {
            them,
            date_created: chat.core.date_created,
            events: &chat.core.events,
            unread_message_index_map: &chat.state.unread_message_index_map,
            read_by_me_up_to: chat.read_by_me_up_to(),
            read_by_them_up_to: chat.read_by_them_up_to(),
            notifications_muted: &chat.notifications_muted,
            archived: &chat.archived,
            user_type: UserType::Bot,
        };

        let from_legacy: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));
        let round_tripped: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat));

        for deserialized in [from_legacy, round_tripped] {
            assert_eq!(deserialized.them, them);
            assert_eq!(deserialized.user_type, UserType::Bot);
            assert_eq!(deserialized.notifications_muted, chat.notifications_muted);
            assert_eq!(deserialized.archived, chat.archived);
            assert_eq!(deserialized.core.date_created, 1);
            assert_eq!(deserialized.read_by_me_up_to(), chat.read_by_me_up_to());
            assert_eq!(deserialized.read_by_them_up_to(), chat.read_by_them_up_to());
            assert_eq!(deserialized.last_updated(), chat.last_updated());
            assert_eq!(
                deserialized.core.events.main_events_reader().latest_message_index(),
                Some(0.into())
            );
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
