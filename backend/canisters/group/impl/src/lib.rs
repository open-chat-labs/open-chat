use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::new_joiner_rewards::{NewJoinerRewardMetrics, NewJoinerRewardStatus, NewJoinerRewards};
use crate::model::participants::{AddResult as AddParticipantResult, ParticipantInternal, Participants};
use crate::new_joiner_rewards::process_new_joiner_reward;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use chat_events::{ChatEventInternal, ChatEvents, Reader};
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::Deref;
use types::{
    Avatar, CanisterId, ChatId, Cryptocurrency, Cycles, EventIndex, FrozenGroupInfo, GroupCanisterGroupChatSummary,
    GroupPermissions, GroupRules, GroupSubtype, MessageIndex, Milliseconds, Notification, TimestampMillis, Timestamped, UserId,
    Version, MAX_THREADS_IN_SUMMARY,
};
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;
use utils::time::{DAY_IN_MS, HOUR_IN_MS};

mod activity_notifications;
mod guards;
mod lifecycle;
mod memory;
mod model;
mod new_joiner_rewards;
mod queries;
mod regular_jobs;
mod timer_job_types;
mod updates;

thread_local! {
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

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    pub fn is_caller_group_index(&self) -> bool {
        self.env.caller() == self.data.group_index_canister_id
    }

    pub fn is_caller_local_group_index(&self) -> bool {
        self.env.caller() == self.data.local_group_index_canister_id
    }

    pub fn push_notification(&mut self, recipients: Vec<UserId>, notification: Notification) {
        if !recipients.is_empty() {
            let args = c2c_push_notification::Args {
                recipients,
                authorizer: Some(self.data.local_group_index_canister_id),
                notification_bytes: candid::encode_one(notification).unwrap(),
            };
            ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));
        }

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn summary(&self, participant: &ParticipantInternal, now: TimestampMillis) -> GroupCanisterGroupChatSummary {
        let data = &self.data;
        let min_visible_event_index = participant.min_visible_event_index();
        let min_visible_message_index = participant.min_visible_message_index();
        let main_events_reader = data.events.visible_main_events_reader(min_visible_event_index, now);
        let latest_event_index = main_events_reader.latest_event_index().unwrap_or_default();

        GroupCanisterGroupChatSummary {
            chat_id: self.env.canister_id().into(),
            last_updated: now,
            name: data.name.clone(),
            description: data.description.clone(),
            subtype: data.subtype.value.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            history_visible_to_new_joiners: data.history_visible_to_new_joiners,
            min_visible_event_index,
            min_visible_message_index,
            latest_message: main_events_reader.latest_message_event(Some(participant.user_id)),
            latest_event_index,
            joined: participant.date_added,
            participant_count: data.participants.len(),
            role: participant.role,
            mentions: participant.most_recent_mentions(None, &data.events, now),
            permissions: data.permissions.clone(),
            notifications_muted: participant.notifications_muted.value,
            metrics: data.events.metrics().clone(),
            my_metrics: data
                .events
                .user_metrics(&participant.user_id, None)
                .cloned()
                .unwrap_or_default(),
            latest_threads: data.events.latest_threads(
                min_visible_event_index,
                participant.threads.iter(),
                None,
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
            frozen: data.frozen.value.clone(),
            wasm_version: Version::default(),
            date_last_pinned: data.date_last_pinned,
            events_ttl: data.events.get_events_time_to_live().value,
            expired_messages: data.events.expired_messages(now),
            next_message_expiry: data.events.next_message_expiry(now),
        }
    }

    pub fn add_participant(&mut self, args: AddParticipantArgs) -> AddParticipantResult {
        let result = self.data.participants.add(
            args.user_id,
            args.principal,
            args.now,
            args.min_visible_event_index,
            args.min_visible_message_index,
            args.mute_notifications,
        );

        if matches!(result, AddParticipantResult::Success(_)) {
            if let Some(new_joiner_rewards) = &mut self.data.new_joiner_rewards {
                if let Ok(amount) = new_joiner_rewards.try_claim_user_reward(args.user_id, args.now) {
                    ic_cdk::spawn(process_new_joiner_reward(
                        self.env.canister_id(),
                        args.user_id,
                        self.data.ledger_canister_id(&Cryptocurrency::InternetComputer),
                        amount,
                        args.now,
                    ));
                }
            }
        }

        result
    }

    pub fn metrics(&self) -> Metrics {
        let chat_metrics = self.data.events.metrics();

        let now = self.env.now();
        let messages_in_last_hour = self.data.events.event_count_since(now.saturating_sub(HOUR_IN_MS), now, |e| {
            matches!(e, ChatEventInternal::Message(_))
        }) as u64;
        let messages_in_last_day = self.data.events.event_count_since(now.saturating_sub(DAY_IN_MS), now, |e| {
            matches!(e, ChatEventInternal::Message(_))
        }) as u64;
        let events_in_last_hour = self
            .data
            .events
            .event_count_since(now.saturating_sub(HOUR_IN_MS), now, |_| true) as u64;
        let events_in_last_day = self
            .data
            .events
            .event_count_since(now.saturating_sub(DAY_IN_MS), now, |_| true) as u64;

        Metrics {
            memory_used: utils::memory::used(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public: self.data.is_public,
            date_created: self.data.date_created,
            members: self.data.participants.len(),
            admins: self.data.participants.admin_count(),
            owners: self.data.participants.owner_count(),
            text_messages: chat_metrics.text_messages,
            image_messages: chat_metrics.image_messages,
            video_messages: chat_metrics.video_messages,
            audio_messages: chat_metrics.audio_messages,
            file_messages: chat_metrics.file_messages,
            polls: chat_metrics.polls,
            poll_votes: chat_metrics.poll_votes,
            cycles_messages: chat_metrics.cycles_messages,
            icp_messages: chat_metrics.icp_messages,
            sns1_messages: chat_metrics.sns1_messages,
            ckbtc_messages: chat_metrics.ckbtc_messages,
            chat_messages: chat_metrics.chat_messages,
            deleted_messages: chat_metrics.deleted_messages,
            giphy_messages: chat_metrics.giphy_messages,
            replies: chat_metrics.replies,
            edits: chat_metrics.edits,
            reactions: chat_metrics.reactions,
            reported_messages: chat_metrics.reported_messages,
            messages_in_last_hour,
            messages_in_last_day,
            events_in_last_hour,
            events_in_last_day,
            last_active: chat_metrics.last_active,
            new_joiner_rewards: self.data.new_joiner_rewards.as_ref().map(|r| r.metrics()),
            frozen: self.data.is_frozen(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                notifications: self.data.notifications_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                icp_ledger: self.data.ledger_canister_id(&Cryptocurrency::InternetComputer),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub subtype: Timestamped<Option<GroupSubtype>>,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub participants: Participants,
    pub events: ChatEvents,
    pub date_created: TimestampMillis,
    pub mark_active_duration: Milliseconds,
    pub group_index_canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub ledger_canister_ids: HashMap<Cryptocurrency, CanisterId>,
    pub proposals_bot_user_id: UserId,
    pub activity_notification_state: ActivityNotificationState,
    pub pinned_messages: Vec<MessageIndex>,
    pub test_mode: bool,
    pub permissions: GroupPermissions,
    pub invite_code: Option<u64>,
    pub invite_code_enabled: bool,
    pub new_joiner_rewards: Option<NewJoinerRewards>,
    pub frozen: Timestamped<Option<FrozenGroupInfo>>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub date_last_pinned: Option<TimestampMillis>,
}

fn initialize_ledger_ids() -> HashMap<Cryptocurrency, CanisterId> {
    [
        (
            Cryptocurrency::InternetComputer,
            Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
        ),
        (
            Cryptocurrency::SNS1,
            Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap(),
        ),
        (
            Cryptocurrency::CKBTC,
            Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
        ),
        (
            Cryptocurrency::CHAT,
            Principal::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap(),
        ),
    ]
    .into_iter()
    .collect()
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        chat_id: ChatId,
        is_public: bool,
        name: String,
        description: String,
        rules: GroupRules,
        subtype: Option<GroupSubtype>,
        avatar: Option<Avatar>,
        history_visible_to_new_joiners: bool,
        creator_principal: Principal,
        creator_user_id: UserId,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
        mark_active_duration: Milliseconds,
        group_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        test_mode: bool,
        permissions: Option<GroupPermissions>,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let events = ChatEvents::new_group_chat(chat_id, name.clone(), description.clone(), creator_user_id, events_ttl, now);

        Data {
            is_public,
            name,
            description,
            rules,
            subtype: Timestamped::new(subtype, now),
            avatar,
            history_visible_to_new_joiners,
            participants,
            events,
            date_created: now,
            mark_active_duration,
            group_index_canister_id,
            local_group_index_canister_id,
            user_index_canister_id,
            local_user_index_canister_id,
            notifications_canister_id,
            ledger_canister_ids: initialize_ledger_ids(),
            proposals_bot_user_id,
            activity_notification_state: ActivityNotificationState::new(now),
            pinned_messages: Vec::new(),
            test_mode,
            permissions: permissions.unwrap_or_default(),
            invite_code: None,
            invite_code_enabled: false,
            new_joiner_rewards: None,
            frozen: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            date_last_pinned: None,
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

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn ledger_canister_id(&self, token: &Cryptocurrency) -> CanisterId {
        self.ledger_canister_ids
            .get(token)
            .copied()
            .unwrap_or_else(|| panic!("Unable to find ledger canister for token '{token:?}'"))
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub public: bool,
    pub date_created: TimestampMillis,
    pub members: u32,
    pub admins: u32,
    pub owners: u32,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub sns1_messages: u64,
    pub ckbtc_messages: u64,
    pub chat_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub reported_messages: u64,
    pub messages_in_last_hour: u64,
    pub messages_in_last_day: u64,
    pub events_in_last_hour: u64,
    pub events_in_last_day: u64,
    pub last_active: TimestampMillis,
    pub new_joiner_rewards: Option<NewJoinerRewardMetrics>,
    pub frozen: bool,
    pub canister_ids: CanisterIds,
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

struct AddParticipantArgs {
    user_id: UserId,
    principal: Principal,
    now: TimestampMillis,
    min_visible_event_index: EventIndex,
    min_visible_message_index: MessageIndex,
    mute_notifications: bool,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
    pub proposals_bot: CanisterId,
    pub icp_ledger: CanisterId,
}
