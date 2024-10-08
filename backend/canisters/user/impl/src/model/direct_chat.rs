use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::{ChatEvents, PushMessageArgs, Reader};
use event_store_producer::{EventStoreClient, Runtime};
use serde::{Deserialize, Serialize};
use std::cmp::min;
use types::{
    DirectChatSummary, DirectChatSummaryUpdates, EventWrapper, Message, MessageId, MessageIndex, Milliseconds, OptionUpdate,
    TimestampMillis, Timestamped, UserId, UserType,
};
use user_canister::SendMessageArgs;

#[derive(Serialize, Deserialize)]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: ChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me_up_to: Timestamped<Option<MessageIndex>>,
    pub read_by_them_up_to: Timestamped<Option<MessageIndex>>,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
    pub user_type: UserType,
    pub unconfirmed: Vec<SendMessageArgs>,
}

impl DirectChat {
    pub fn new(
        them: UserId,
        user_type: UserType,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: ChatEvents::new_direct_chat(them, events_ttl, anonymized_chat_id, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me_up_to: Timestamped::new(None, now),
            read_by_them_up_to: Timestamped::new(None, now),
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
            user_type,
            unconfirmed: Vec::new(),
        }
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

    pub fn push_message<R: Runtime + Send + 'static>(
        &mut self,
        sent_by_me: bool,
        args: PushMessageArgs,
        their_message_index: Option<MessageIndex>,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> EventWrapper<Message> {
        let now = args.now;
        let message_event = self.events.push_message(args, event_store_client);

        self.mark_read_up_to(message_event.event.message_index, sent_by_me, now);

        if !sent_by_me {
            if let Some(their_message_index) = their_message_index {
                self.unread_message_index_map
                    .add(message_event.event.message_index, their_message_index);
            }
        }

        message_event
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, me: bool, now: TimestampMillis) -> bool {
        if let Some(latest_message_index) = self.events.main_events_list().latest_message_index() {
            let val = if me { &mut self.read_by_me_up_to } else { &mut self.read_by_them_up_to };
            let read_up_to = min(message_index, latest_message_index);
            if val.value < Some(read_up_to) {
                *val = Timestamped::new(Some(read_up_to), now);
                return true;
            }
        }
        false
    }

    // TODO (maybe?)
    // This should only return up to N messages so that we never exceed the c2c size limit
    pub fn get_pending_messages(&self) -> Vec<SendMessageArgs> {
        self.unconfirmed.clone()
    }

    pub fn mark_message_confirmed(&mut self, message_id: MessageId) {
        self.unconfirmed.retain(|m| m.message_id != message_id);
    }

    pub fn to_summary(&self, my_user_id: UserId) -> DirectChatSummary {
        let events_reader = self.events.main_events_reader();
        let events_ttl = self.events.get_events_time_to_live();

        DirectChatSummary {
            them: self.them,
            last_updated: self.last_updated(),
            latest_message: events_reader.latest_message_event(Some(my_user_id)).unwrap(),
            latest_event_index: events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: events_reader.latest_message_index().unwrap_or_default(),
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
            video_call_in_progress: self.events.video_call_in_progress().value.clone(),
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user_id: UserId) -> DirectChatSummaryUpdates {
        let events_reader = self.events.main_events_reader();

        let has_new_events = events_reader.latest_event_timestamp().map_or(false, |ts| ts > updates_since);
        let latest_message = events_reader.latest_message_event_if_updated(updates_since, Some(my_user_id));
        let latest_event_index = if has_new_events { events_reader.latest_event_index() } else { None };
        let latest_message_index = if has_new_events { events_reader.latest_message_index() } else { None };
        let notifications_muted = self.notifications_muted.if_set_after(updates_since).copied();
        let metrics = if has_new_events { Some(self.events.metrics().hydrate()) } else { None };
        let events_ttl = self.events.get_events_time_to_live();
        let updated_events: Vec<_> = self
            .events
            .iter_recently_updated_events()
            .take_while(|(_, _, ts)| *ts > updates_since)
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
            video_call_in_progress: self
                .events
                .video_call_in_progress()
                .if_set_after(updates_since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
        }
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
