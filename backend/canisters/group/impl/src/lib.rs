use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::participants::{ParticipantInternal, Participants};
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use chat_events::{ChatEvents, GroupChatEvents};
use notifications_canister::c2c_push_notification;
use serde::{de, Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::Deref;
use types::{
    Avatar, CanisterId, ChatId, Cycles, EventIndex, GroupChatSummaryInternal, GroupPermissions, MessageIndex, Milliseconds,
    Notification, TimestampMillis, Timestamped, UserId, Version,
};
use utils::env::Environment;
use utils::memory;
use utils::rand::get_random_item;
use utils::regular_jobs::RegularJobs;

mod guards;
mod lifecycle;
mod model;
mod queries;
mod regular_jobs;
mod updates;

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
    pub regular_jobs: RegularJobs<Data>,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data, regular_jobs: RegularJobs<Data>) -> RuntimeState {
        RuntimeState { env, data, regular_jobs }
    }

    pub fn is_caller_participant(&self) -> bool {
        self.data.participants.get(self.env.caller()).is_some()
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_callback_canister(&self) -> bool {
        self.env.caller() == self.data.callback_canister_id
    }

    pub fn push_notification(&mut self, recipients: Vec<UserId>, notification: Notification) {
        let random = self.env.random_u32() as usize;

        if let Some(canister_id) = get_random_item(&self.data.notifications_canister_ids, random) {
            let args = c2c_push_notification::Args {
                recipients,
                notification,
            };
            ic_cdk::spawn(push_notification_inner(*canister_id, args));
        }

        async fn push_notification_inner(canister_id: CanisterId, args: notifications_canister::c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn summary(&self, participant: &ParticipantInternal) -> GroupChatSummaryInternal {
        let data = &self.data;
        let latest_event = data.events.last();
        let min_visible_message_index = participant.min_visible_message_index();

        GroupChatSummaryInternal {
            chat_id: self.env.canister_id().into(),
            last_updated: latest_event.timestamp,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            history_visible_to_new_joiners: data.history_visible_to_new_joiners,
            min_visible_event_index: participant.min_visible_event_index(),
            min_visible_message_index,
            latest_message: data
                .events
                .latest_message(Some(participant.user_id))
                .filter(|m| m.event.message_index >= min_visible_message_index),
            latest_event_index: latest_event.index,
            joined: participant.date_added,
            participant_count: data.participants.len(),
            role: participant.role,
            mentions: participant.get_most_recent_mentions(&data.events),
            pinned_message: None,
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            owner_id: data.owner_id,
            permissions: data.permissions.clone(),
            notifications_muted: participant.notifications_muted,
            metrics: data.events.metrics().clone(),
            my_metrics: data
                .events
                .user_metrics(&participant.user_id, None)
                .cloned()
                .unwrap_or_default(),
        }
    }

    pub fn metrics(&self) -> Metrics {
        let chat_metrics = self.data.events.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            participants: self.data.participants.len() as u32,
            admins: self.data.participants.admin_count(),
            text_messages: chat_metrics.text_messages,
            image_messages: chat_metrics.image_messages,
            video_messages: chat_metrics.video_messages,
            audio_messages: chat_metrics.audio_messages,
            file_messages: chat_metrics.file_messages,
            polls: chat_metrics.polls,
            poll_votes: chat_metrics.poll_votes,
            cycles_messages: chat_metrics.cycles_messages,
            icp_messages: chat_metrics.icp_messages,
            deleted_messages: chat_metrics.deleted_messages,
            giphy_messages: chat_metrics.giphy_messages,
            replies: chat_metrics.replies,
            edits: chat_metrics.edits,
            reactions: chat_metrics.reactions,
            last_active: chat_metrics.last_active,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub participants: Participants,
    #[serde(deserialize_with = "deserialize_chat_events")]
    pub events: ChatEvents,
    pub date_created: TimestampMillis,
    pub mark_active_duration: Milliseconds,
    pub group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub callback_canister_id: CanisterId,
    pub activity_notification_state: ActivityNotificationState,
    pub pinned_messages: Vec<MessageIndex>,
    pub test_mode: bool,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub invite_code: Option<u64>,
    pub invite_code_enabled: bool,
    #[serde(skip)]
    pub threads: HashMap<MessageIndex, ChatEvents>,
}

fn deserialize_chat_events<'de, D>(deserializer: D) -> Result<ChatEvents, D::Error>
where
    D: de::Deserializer<'de>,
{
    let group_chat_events: GroupChatEvents = de::Deserialize::deserialize(deserializer)?;
    Ok(group_chat_events.inner)
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        chat_id: ChatId,
        is_public: bool,
        name: String,
        description: String,
        avatar: Option<Avatar>,
        history_visible_to_new_joiners: bool,
        creator_principal: Principal,
        creator_user_id: UserId,
        now: TimestampMillis,
        mark_active_duration: Milliseconds,
        group_index_canister_id: CanisterId,
        user_index_canister_id: CanisterId,
        notifications_canister_ids: Vec<CanisterId>,
        callback_canister_id: CanisterId,
        test_mode: bool,
        permissions: Option<GroupPermissions>,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let events = ChatEvents::new_group_chat(chat_id, name.clone(), description.clone(), creator_user_id, now);

        Data {
            is_public,
            name,
            description,
            avatar,
            history_visible_to_new_joiners,
            participants,
            events,
            date_created: now,
            mark_active_duration,
            group_index_canister_id,
            user_index_canister_id,
            notifications_canister_ids,
            callback_canister_id,
            activity_notification_state: ActivityNotificationState::new(now),
            pinned_messages: Vec::new(),
            test_mode,
            owner_id: creator_user_id,
            permissions: permissions.unwrap_or_default(),
            invite_code: None,
            invite_code_enabled: false,
            threads: HashMap::new(),
        }
    }

    pub fn min_visible_event_index(&self, caller: Principal, invite_code: Option<u64>) -> Option<EventIndex> {
        match self.participants.get_by_principal(&caller) {
            Some(p) => Some(p.min_visible_event_index()),
            None => {
                if self.is_accessible_by_non_member(invite_code) && self.history_visible_to_new_joiners {
                    Some(EventIndex::default())
                } else {
                    None
                }
            }
        }
    }

    pub fn is_accessible_by_non_member(&self, invite_code: Option<u64>) -> bool {
        if self.invite_code_enabled {
            if let Some(provided_code) = invite_code {
                if let Some(stored_code) = self.invite_code {
                    return provided_code == stored_code;
                }
            }
        }

        self.is_public
    }

    pub fn chat_events(
        &self,
        thread_message_index: Option<MessageIndex>,
        min_visible_event_index: EventIndex,
    ) -> Option<&ChatEvents> {
        if let Some(thread_message_index) = thread_message_index {
            self.events
                .get_event_index_by_message_index(thread_message_index)
                .filter(|thread_event_index| *thread_event_index >= min_visible_event_index)
                .and_then(|_| self.threads.get(&thread_message_index))
        } else {
            Some(&self.events)
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub participants: u32,
    pub admins: u32,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub last_active: TimestampMillis,
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}
