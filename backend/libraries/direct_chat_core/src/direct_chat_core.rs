use chat_events::{ChatEvents, EventPusher, PushMessageArgs, Reader};
use serde::{Deserialize, Serialize};
use std::cmp::min;
use types::{EventWrapper, Message, MessageId, MessageIndex, Milliseconds, TimestampMillis, Timestamped, UserId};

/// One of the two users in a direct chat, identified by position rather than by user id so that
/// the core holds no user ids. In a User canister the first participant is the canister's user and
/// the second is the other user. When a chat is shared by two users in one canister, the holder of
/// the core maps each user id onto a position.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
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
#[derive(Serialize, Deserialize)]
pub struct DirectChatCore {
    pub date_created: TimestampMillis,
    pub events: ChatEvents,
    // Indexed by `Participant`
    read_up_to: [Timestamped<Option<MessageIndex>>; 2],
}

impl DirectChatCore {
    // `my_user_id` is the first participant and `them` the second. The events are created from the
    // first participant's perspective, so only their per-user metrics are kept.
    pub fn new(
        my_user_id: UserId,
        them: UserId,
        key_id: u32,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChatCore {
        DirectChatCore {
            date_created: now,
            events: ChatEvents::new_direct_chat(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now),
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

    pub fn last_updated(&self) -> TimestampMillis {
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
    pub fn mark_read_up_to(&mut self, participant: Participant, message_index: MessageIndex, now: TimestampMillis) -> bool {
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

    pub fn read_up_to(&self, participant: Participant) -> &Timestamped<Option<MessageIndex>> {
        &self.read_up_to[participant.index()]
    }

    pub fn main_message_id_to_index(&self, message_id: MessageId) -> MessageIndex {
        self.events
            .main_events_reader()
            .message_internal(message_id.into())
            .unwrap()
            .message_index
    }

    pub fn main_message_index_to_id(&self, message_index: MessageIndex) -> MessageId {
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
    fn participants_are_each_others_other() {
        assert_eq!(Participant::First.other(), Participant::Second);
        assert_eq!(Participant::Second.other(), Participant::First);
    }

    fn setup() -> DirectChatCore {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        DirectChatCore::new(ME, THEM, 1, None, 123, 1)
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
