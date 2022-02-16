use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::participants::{ParticipantInternal, Participants};
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use chat_events::GroupChatEvents;
use group_canister::Summary;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{
    Avatar, CanisterId, ChatId, Cycles, EventIndex, MessageIndex, Milliseconds, Notification, TimestampMillis, Timestamped,
    UserId, Version,
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

const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

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

    pub fn summary(&self, participant: &ParticipantInternal) -> Summary {
        let data = &self.data;
        let latest_event = data.events.last();
        let min_visible_message_index = participant.min_visible_message_index();

        Summary {
            chat_id: self.env.canister_id().into(),
            last_updated: latest_event.timestamp,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            min_visible_event_index: participant.min_visible_event_index(),
            min_visible_message_index,
            latest_message: data
                .events
                .latest_message()
                .filter(|m| m.event.message_index >= min_visible_message_index),
            latest_event_index: latest_event.index,
            joined: participant.date_added,
            participant_count: data.participants.len(),
            role: participant.role,
            mentions: participant.get_most_recent_mentions(&data.events),
            pinned_message: data.pinned_message,
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            owner_id: data.owner_id,
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
            events: chat_metrics.total_events,
            text_messages: chat_metrics.text_messages,
            image_messages: chat_metrics.image_messages,
            video_messages: chat_metrics.video_messages,
            audio_messages: chat_metrics.audio_messages,
            file_messages: chat_metrics.file_messages,
            cycles_messages: chat_metrics.cycles_messages,
            deleted_messages: chat_metrics.deleted_messages,
            total_edits: chat_metrics.total_edits,
            replies: chat_metrics.replies,
            total_reactions: chat_metrics.total_reactions,
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
    pub events: GroupChatEvents,
    pub date_created: TimestampMillis,
    pub mark_active_duration: Milliseconds,
    pub group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub activity_notification_state: ActivityNotificationState,
    pub pinned_message: Option<MessageIndex>,
    pub test_mode: bool,

    #[serde(default = "default_userid")]
    pub owner_id: UserId,
}

fn default_userid() -> UserId {
    Principal::anonymous().into()
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
        test_mode: bool,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let events = GroupChatEvents::new(chat_id, name.clone(), description.clone(), creator_user_id, now);

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
            activity_notification_state: ActivityNotificationState::new(now),
            pinned_message: None,
            test_mode,
            owner_id: creator_user_id,
        }
    }

    pub fn min_visible_event_index(&self, caller: Principal) -> Option<EventIndex> {
        if self.is_public {
            Some(EventIndex::default())
        } else {
            self.participants
                .get_by_principal(&caller)
                .map(|participant| participant.min_visible_event_index())
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
    pub events: u64,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub cycles_messages: u64,
    pub deleted_messages: u64,
    pub total_edits: u64,
    pub replies: u64,
    pub total_reactions: u64,
    pub last_active: TimestampMillis,
}

fn run_regular_jobs() {
    mutate_state(|state| {
        let now = state.env.now();
        state.regular_jobs.run(now, &mut state.data)
    });
}
