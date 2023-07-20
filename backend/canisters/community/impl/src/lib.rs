use crate::model::channels::Channels;
use crate::model::groups_being_imported::{GroupBeingImportedSummary, GroupsBeingImported};
use crate::model::members::CommunityMembers;
use crate::timer_job_types::TimerJob;
use activity_notification_state::ActivityNotificationState;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use chat_events::ChatMetricsInternal;
use fire_and_forget_handler::FireAndForgetHandler;
use model::{events::CommunityEvents, invited_users::InvitedUsers, members::CommunityMemberInternal};
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::ops::Deref;
use types::{
    AccessGate, AccessRules, CanisterId, ChannelId, ChatMetrics, CommunityCanisterCommunitySummary, CommunityMembership,
    CommunityPermissions, Cycles, Document, FrozenGroupInfo, Milliseconds, Notification, TimestampMillis, Timestamped, UserId,
    Version,
};
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;

mod activity_notifications;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
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

    pub fn is_caller_proposals_bot(&self) -> bool {
        self.env.caller() == self.data.proposals_bot_user_id.into()
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

    pub fn summary(&self, member: Option<&CommunityMemberInternal>, now: TimestampMillis) -> CommunityCanisterCommunitySummary {
        let data = &self.data;

        let (channels, membership) = if let Some(m) = member {
            let membership = CommunityMembership {
                joined: m.date_added,
                role: m.role,
            };

            // Return all the channels that the user is a member of
            let channels: Vec<_> = m
                .channels
                .iter()
                .filter_map(|c| self.data.channels.get(c))
                .filter_map(|c| c.summary(Some(m.user_id), true, data.is_public, now))
                .collect();

            (channels, Some(membership))
        } else {
            // Return all default channels
            let channels: Vec<_> = self
                .data
                .channels
                .default_channels()
                .iter()
                .filter_map(|c| c.summary(None, false, data.is_public, now))
                .collect();

            (channels, None)
        };

        CommunityCanisterCommunitySummary {
            community_id: self.env.canister_id().into(),
            last_updated: now,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Document::id(&data.avatar),
            banner_id: Document::id(&data.banner),
            is_public: data.is_public,
            latest_event_index: data.events.latest_event_index(),
            member_count: data.members.len(),
            permissions: data.permissions.clone(),
            frozen: data.frozen.value.clone(),
            gate: data.gate.value.clone(),
            primary_language: data.primary_language.clone(),
            channels,
            membership,
            metrics: data.cached_chat_metrics.value.clone(),
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public: self.data.is_public,
            date_created: self.data.date_created,
            members: self.data.members.len(),
            admins: self.data.members.admin_count(),
            owners: self.data.members.owner_count(),
            blocked: self.data.members.blocked().len() as u32,
            invited: self.data.invited_users.len() as u32,
            frozen: self.data.is_frozen(),
            groups_being_imported: self.data.groups_being_imported.summaries(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                notifications: self.data.notifications_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    is_public: bool,
    name: String,
    description: String,
    rules: AccessRules,
    avatar: Option<Document>,
    banner: Option<Document>,
    permissions: CommunityPermissions,
    gate: Timestamped<Option<AccessGate>>,
    primary_language: String,
    user_index_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    group_index_canister_id: CanisterId,
    local_group_index_canister_id: CanisterId,
    notifications_canister_id: CanisterId,
    proposals_bot_user_id: UserId,
    date_created: TimestampMillis,
    members: CommunityMembers,
    channels: Channels,
    events: CommunityEvents,
    invited_users: InvitedUsers,
    invite_code: Option<u64>,
    invite_code_enabled: bool,
    frozen: Timestamped<Option<FrozenGroupInfo>>,
    timer_jobs: TimerJobs<TimerJob>,
    fire_and_forget_handler: FireAndForgetHandler,
    activity_notification_state: ActivityNotificationState,
    groups_being_imported: GroupsBeingImported,
    test_mode: bool,
    cached_chat_metrics: Timestamped<ChatMetrics>,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        created_by_principal: Principal,
        created_by_user_id: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: AccessRules,
        avatar: Option<Document>,
        banner: Option<Document>,
        permissions: CommunityPermissions,
        primary_language: String,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        gate: Option<AccessGate>,
        default_channels: Vec<(ChannelId, String)>,
        mark_active_duration: Milliseconds,
        test_mode: bool,
        now: TimestampMillis,
    ) -> Data {
        let channels = Channels::new(created_by_user_id, default_channels, now);
        let members = CommunityMembers::new(created_by_principal, created_by_user_id, channels.default_channel_ids(), now);
        let events = CommunityEvents::new(name.clone(), description.clone(), created_by_user_id, now);

        Data {
            is_public,
            name,
            description,
            rules,
            avatar,
            banner,
            permissions,
            gate: Timestamped::new(gate, now),
            primary_language,
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            local_group_index_canister_id,
            notifications_canister_id,
            proposals_bot_user_id,
            date_created: now,
            members,
            channels,
            events,
            invited_users: InvitedUsers::default(),
            invite_code: None,
            invite_code_enabled: false,
            frozen: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            activity_notification_state: ActivityNotificationState::new(now, mark_active_duration),
            groups_being_imported: GroupsBeingImported::default(),
            test_mode,
            cached_chat_metrics: Timestamped::default(),
        }
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn is_accessible(&self, caller: Principal, invite_code: Option<u64>) -> bool {
        self.is_public
            || self.members.get(caller).is_some()
            || self.invited_users.get(&caller).is_some()
            || self.is_invite_code_valid(invite_code)
    }

    // This will get the user_id if called directly by a community member, c2c from a community
    // member's user canister, or directly by an invited user
    pub fn user_id(&self, principal: Principal) -> Option<UserId> {
        self.members
            .lookup_user_id(principal)
            .or_else(|| self.invited_users.get(&principal).map(|u| u.invited))
    }

    pub fn build_chat_metrics(&mut self, now: TimestampMillis) {
        let mut metrics = ChatMetricsInternal::default();

        for channel in self.channels.iter().filter(|c| c.chat.is_public) {
            metrics.merge(channel.chat.events.metrics());
        }

        self.cached_chat_metrics = Timestamped::new(metrics.hydrate(), now);
    }

    fn is_invite_code_valid(&self, invite_code: Option<u64>) -> bool {
        if self.invite_code_enabled {
            if let Some(provided_code) = invite_code {
                if let Some(stored_code) = self.invite_code {
                    return provided_code == stored_code;
                }
            }
        }

        false
    }
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub public: bool,
    pub date_created: TimestampMillis,
    pub members: u32,
    pub admins: u32,
    pub owners: u32,
    pub blocked: u32,
    pub invited: u32,
    pub frozen: bool,
    pub groups_being_imported: Vec<GroupBeingImportedSummary>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
}
