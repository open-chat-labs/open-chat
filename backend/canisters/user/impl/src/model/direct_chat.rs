use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::AllChatEvents;
use serde::{Deserialize, Serialize};
use types::{DirectChatSummary, DirectChatSummaryUpdates, MessageIndex, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize)]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: AllChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me_up_to: Timestamped<Option<MessageIndex>>,
    pub read_by_them_up_to: Timestamped<Option<MessageIndex>>,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
    pub is_bot: bool,
}

impl DirectChat {
    pub fn new(them: UserId, is_bot: bool, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: AllChatEvents::new_direct_chat(them, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me_up_to: Timestamped::new(None, now),
            read_by_them_up_to: Timestamped::new(None, now),
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
            is_bot,
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        let timestamps = [
            self.events.main().last().timestamp,
            self.read_by_me_up_to.timestamp,
            self.read_by_them_up_to.timestamp,
            self.notifications_muted.timestamp,
            self.archived.timestamp,
        ];

        timestamps.into_iter().max().unwrap()
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, me: bool, now: TimestampMillis) -> bool {
        let val = if me { &mut self.read_by_me_up_to } else { &mut self.read_by_them_up_to };
        if val.value < Some(message_index) {
            *val = Timestamped::new(Some(message_index), now);
            true
        } else {
            false
        }
    }

    pub fn to_summary(&self, my_user_id: UserId) -> DirectChatSummary {
        let chat_events = self.events.main();

        DirectChatSummary {
            them: self.them,
            latest_message: chat_events.latest_message(Some(my_user_id)).unwrap(),
            latest_event_index: chat_events.last().index,
            date_created: self.date_created,
            read_by_me_up_to: self.read_by_me_up_to.value,
            read_by_them_up_to: self.read_by_them_up_to.value,
            notifications_muted: self.notifications_muted.value,
            metrics: self.events.metrics().clone(),
            my_metrics: self.events.user_metrics(&my_user_id, None).cloned().unwrap_or_default(),
            archived: self.archived.value,
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user_id: UserId) -> DirectChatSummaryUpdates {
        let chat_events = self.events.main();

        let latest_message = chat_events.latest_message_if_updated(updates_since, Some(my_user_id));
        let latest_event = chat_events.last();
        let has_new_events = latest_event.timestamp > updates_since;
        let latest_event_index = if has_new_events { Some(latest_event.index) } else { None };
        let metrics = if has_new_events { Some(self.events.metrics().clone()) } else { None };
        let notifications_muted = self.notifications_muted.if_set_after(updates_since).copied();
        let affected_events = chat_events.affected_event_indexes_since(updates_since, 100);

        DirectChatSummaryUpdates {
            chat_id: self.them.into(),
            latest_message,
            latest_event_index,
            read_by_me_up_to: self.read_by_me_up_to.if_set_after(updates_since).copied().flatten(),
            read_by_them_up_to: self.read_by_them_up_to.if_set_after(updates_since).copied().flatten(),
            notifications_muted,
            affected_events,
            metrics,
            my_metrics: self.events.user_metrics(&my_user_id, Some(updates_since)).cloned(),
            archived: self.archived.if_set_after(updates_since).copied(),
        }
    }
}
