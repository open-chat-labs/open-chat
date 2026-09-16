use chat_events::{ChatEvents, EventPusher, PushMessageArgs, Reader};
use serde::{Deserialize, Serialize};
use std::cmp::min;
use types::{EventIndex, EventWrapper, Message, MessageId, MessageIndex, Milliseconds, TimestampMillis, Timestamped, UserId};

/// One of the two users in a direct chat, identified by position rather than by user id so that
/// the core holds no user ids. In a User canister the first participant is the canister's user and
/// the second is the other user. When a chat is shared by two users in one canister, the holder of
/// the core maps each user id onto a position.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum Participant {
    First,
    Second,
}

impl Participant {
    pub fn other(self) -> Participant {
        match self {
            Participant::First => Participant::Second,
            Participant::Second => Participant::First,
        }
    }

    fn index(self) -> usize {
        match self {
            Participant::First => 0,
            Participant::Second => 1,
        }
    }
}

/// The part of a direct chat which both users see identically: the events and each user's read
/// position. Everything a single user owns (whether they have muted or archived the chat, who the
/// other user is to them) is held outside the core, so that a single core can be shared by two
/// users in the same canister.
///
/// The core is opaque outside this crate: it is only read or modified through a `DirectChat`
/// wrapping it, so that a message can never be pushed without the user's state alongside it
/// being kept in step.
#[derive(Serialize, Deserialize)]
pub struct DirectChatCore {
    pub(crate) date_created: TimestampMillis,
    pub(crate) events: ChatEvents,
    // Indexed by `Participant`
    read_up_to: [Timestamped<Option<MessageIndex>>; 2],
}

impl DirectChatCore {
    // A core held by one user alone. `my_user_id` is the first participant and `them` the second.
    // The events are created from the first participant's perspective, so only their per-user
    // metrics are kept.
    pub fn new(
        my_user_id: UserId,
        them: UserId,
        key_id: u32,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChatCore {
        Self::from_events(
            ChatEvents::new_direct_chat(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now),
            now,
        )
    }

    // A core shared by both users of a chat, so both users' per-user metrics are kept. `second` is
    // the user in the second position, which only serves to label the events (see
    // `ChatEvents::new_shared_direct_chat`).
    pub fn new_shared(
        second: UserId,
        key_id: u32,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChatCore {
        Self::from_events(
            ChatEvents::new_shared_direct_chat(second, key_id, events_ttl, anonymized_chat_id, now),
            now,
        )
    }

    fn from_events(events: ChatEvents, now: TimestampMillis) -> DirectChatCore {
        DirectChatCore {
            date_created: now,
            events,
            read_up_to: [Timestamped::new(None, now), Timestamped::new(None, now)],
        }
    }

    pub(crate) fn from_parts(
        date_created: TimestampMillis,
        events: ChatEvents,
        read_up_to_by_first: Timestamped<Option<MessageIndex>>,
        read_up_to_by_second: Timestamped<Option<MessageIndex>>,
    ) -> DirectChatCore {
        DirectChatCore {
            date_created,
            events,
            read_up_to: [read_up_to_by_first, read_up_to_by_second],
        }
    }

    pub(crate) fn last_updated(&self) -> TimestampMillis {
        [
            self.events.last_updated().unwrap_or_default(),
            self.read_up_to[0].timestamp,
            self.read_up_to[1].timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    // Pushes the message and marks it as read by its sender. Crate-private so that a message is
    // only ever pushed via a wrapper which also maintains the state it keeps alongside the core
    pub(crate) fn push_message<P: EventPusher>(
        &mut self,
        args: PushMessageArgs,
        sender: Participant,
        event_pusher: Option<P>,
    ) -> EventWrapper<Message> {
        let now = args.now;
        let (message_event, _) = self.events.push_message(args, event_pusher);

        self.mark_read_up_to(sender, message_event.event.message_index, now);

        message_event
    }

    // Moves the participant's read position forward to `message_index`, capped at the latest
    // message. Returns whether it moved.
    pub(crate) fn mark_read_up_to(
        &mut self,
        participant: Participant,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> bool {
        if let Some(latest_message_index) = self.events.main_events_list().latest_message_index() {
            let val = &mut self.read_up_to[participant.index()];
            let read_up_to = min(message_index, latest_message_index);
            if val.value < Some(read_up_to) {
                *val = Timestamped::new(Some(read_up_to), now);
                return true;
            }
        }
        false
    }

    pub(crate) fn read_up_to(&self, participant: Participant) -> &Timestamped<Option<MessageIndex>> {
        &self.read_up_to[participant.index()]
    }

    // Prepares the core for `participant` getting the chat back after deleting their side of it
    // while the other user kept theirs. Everything so far stays hidden from them: the index
    // returned is the one their new state's view of the events starts from, and every message so
    // far is marked as read by them so that only messages from here on count as unread. This is
    // the one operation on a core made outside a `DirectChat`, since it comes before the user has
    // any state for the chat.
    pub fn rejoin(&mut self, participant: Participant, now: TimestampMillis) -> EventIndex {
        let events_list = self.events.main_events_list();
        let min_visible_event_index = events_list.next_event_index();
        if let Some(latest_message_index) = events_list.latest_message_index() {
            self.mark_read_up_to(participant, latest_message_index, now);
        }
        min_visible_event_index
    }

    pub(crate) fn main_message_id_to_index(&self, message_id: MessageId) -> MessageIndex {
        self.events
            .main_events_reader()
            .message_internal(message_id.into())
            .unwrap()
            .message_index
    }

    pub(crate) fn main_message_index_to_id(&self, message_index: MessageIndex) -> MessageId {
        self.events
            .main_events_reader()
            .message_internal(message_index.into())
            .unwrap()
            .message_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    const ME: UserId = user(1);
    const THEM: UserId = user(2);

    #[test]
    fn pushing_a_message_marks_it_read_by_its_sender_only() {
        let mut core = setup();

        let event = core.push_message::<NullEventPusher>(message(ME, 1, 100), Participant::First, None);
        assert_eq!(event.event.message_index, 0.into());
        assert_eq!(core.read_up_to(Participant::First).value, Some(0.into()));
        assert_eq!(core.read_up_to(Participant::First).timestamp, 100);
        assert_eq!(core.read_up_to(Participant::Second).value, None);

        let event = core.push_message::<NullEventPusher>(message(THEM, 2, 200), Participant::Second, None);
        assert_eq!(event.event.message_index, 1.into());
        assert_eq!(core.read_up_to(Participant::First).value, Some(0.into()));
        assert_eq!(core.read_up_to(Participant::Second).value, Some(1.into()));
        assert_eq!(core.read_up_to(Participant::Second).timestamp, 200);
        assert_eq!(core.last_updated(), 200);
    }

    #[test]
    fn read_positions_only_move_forwards_and_are_capped_at_the_latest_message() {
        let mut core = setup();
        assert!(!core.mark_read_up_to(Participant::First, 0.into(), 50), "no messages yet");

        core.push_message::<NullEventPusher>(message(THEM, 1, 100), Participant::Second, None);
        core.push_message::<NullEventPusher>(message(THEM, 2, 110), Participant::Second, None);

        assert!(core.mark_read_up_to(Participant::First, 0.into(), 200));
        assert_eq!(core.read_up_to(Participant::First).value, Some(0.into()));
        assert!(
            !core.mark_read_up_to(Participant::First, 0.into(), 210),
            "already read that far"
        );
        assert_eq!(core.read_up_to(Participant::First).timestamp, 200);
        assert!(core.mark_read_up_to(Participant::First, 10.into(), 220));
        assert_eq!(
            core.read_up_to(Participant::First).value,
            Some(1.into()),
            "capped at the latest message"
        );
        assert_eq!(core.read_up_to(Participant::Second).value, Some(1.into()));
        assert_eq!(core.last_updated(), 220);
    }

    #[test]
    fn rejoining_hides_the_events_so_far_and_marks_the_messages_read() {
        let mut core = setup();
        assert_eq!(
            core.rejoin(Participant::Second, 50),
            1.into(),
            "only the created event so far"
        );
        assert_eq!(core.read_up_to(Participant::Second).value, None);

        core.push_message::<NullEventPusher>(message(ME, 1, 100), Participant::First, None);
        core.push_message::<NullEventPusher>(message(ME, 2, 110), Participant::First, None);

        assert_eq!(core.rejoin(Participant::Second, 200), 3.into());
        assert_eq!(core.read_up_to(Participant::Second).value, Some(1.into()));
        assert_eq!(core.read_up_to(Participant::Second).timestamp, 200);
        assert_eq!(core.read_up_to(Participant::First).value, Some(1.into()));
    }

    #[test]
    fn a_shared_core_keeps_both_users_metrics() {
        init_stable_memory_map();
        let mut owned = DirectChatCore::new(ME, THEM, 1, None, 123, 1);
        let mut shared = DirectChatCore::new_shared(THEM, 2, None, 456, 1);

        for core in [&mut owned, &mut shared] {
            core.push_message::<NullEventPusher>(message(ME, 1, 100), Participant::First, None);
            core.push_message::<NullEventPusher>(message(THEM, 2, 200), Participant::Second, None);
        }

        let text_messages = |core: &DirectChatCore, user_id: UserId| {
            core.events.user_metrics(&user_id, None).map(|m| m.hydrate().text_messages)
        };
        assert_eq!(text_messages(&owned, ME), Some(1));
        assert_eq!(text_messages(&owned, THEM), None, "a core held by one user skips the other's");
        assert_eq!(text_messages(&shared, ME), Some(1));
        assert_eq!(text_messages(&shared, THEM), Some(1));
    }

    fn setup() -> DirectChatCore {
        init_stable_memory_map();
        DirectChatCore::new(ME, THEM, 1, None, 123, 1)
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
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

    const fn user(i: u8) -> UserId {
        UserId::new(Principal::from_slice(&[i; 10]))
    }
}
