use crate::model::new_joiner_rewards::{NewJoinerRewardMetrics, NewJoinerRewardStatus, NewJoinerRewards};
use crate::model::upgrade_instruction_counts::{InstructionCountEntry, InstructionCountFunctionId, InstructionCountsLog};
use crate::new_joiner_rewards::process_new_joiner_reward;
use crate::timer_job_types::TimerJob;
use activity_notification_state::ActivityNotificationState;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use chat_events::{ChatEventInternal, Reader};
use fire_and_forget_handler::FireAndForgetHandler;
use group_chat_core::{AddResult as AddMemberResult, GroupChatCore, GroupMemberInternal, InvitedUsersResult, UserInvitation};
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::ops::Deref;
use types::{
    AccessGate, AccessRules, CanisterId, ChatMetrics, CommunityId, Cryptocurrency, Cycles, Document, EventIndex,
    FrozenGroupInfo, GroupCanisterGroupChatSummary, GroupPermissions, GroupSubtype, MessageIndex, Milliseconds, Notification,
    TimestampMillis, Timestamped, UserId, Version, MAX_THREADS_IN_SUMMARY,
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

    pub fn is_caller_community_being_imported_into(&self) -> bool {
        if let Some(community_id) = self.data.community_being_imported_into {
            CommunityId::from(self.env.caller()) == community_id
        } else {
            false
        }
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

    pub fn summary(&self, member: &GroupMemberInternal, now: TimestampMillis) -> GroupCanisterGroupChatSummary {
        let chat = &self.data.chat;
        let min_visible_event_index = member.min_visible_event_index();
        let min_visible_message_index = member.min_visible_message_index();
        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index, now);
        let latest_event_index = main_events_reader.latest_event_index().unwrap_or_default();

        GroupCanisterGroupChatSummary {
            chat_id: self.env.canister_id().into(),
            last_updated: now,
            name: chat.name.clone(),
            description: chat.description.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: Document::id(&chat.avatar),
            is_public: chat.is_public,
            history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
            min_visible_event_index,
            min_visible_message_index,
            latest_message: main_events_reader.latest_message_event(Some(member.user_id)),
            latest_event_index,
            joined: member.date_added,
            participant_count: chat.members.len(),
            role: member.role.into(),
            mentions: member.most_recent_mentions(None, &chat.events, now),
            permissions: chat.permissions.clone(),
            notifications_muted: member.notifications_muted.value,
            metrics: chat.events.metrics().hydrate(),
            my_metrics: chat
                .events
                .user_metrics(&member.user_id, None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            latest_threads: chat.events.latest_threads(
                min_visible_event_index,
                member.threads.iter(),
                None,
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
            frozen: self.data.frozen.value.clone(),
            wasm_version: Version::default(),
            date_last_pinned: chat.date_last_pinned,
            events_ttl: chat.events.get_events_time_to_live().value,
            expired_messages: chat.events.expired_messages(now),
            next_message_expiry: chat.events.next_message_expiry(now),
            gate: chat.gate.value.clone(),
        }
    }

    pub fn add_member(&mut self, args: AddMemberArgs) -> AddMemberResult {
        let result = self.data.chat.members.add(
            args.user_id,
            args.now,
            args.min_visible_event_index,
            args.min_visible_message_index,
            args.mute_notifications,
        );

        if matches!(result, AddMemberResult::Success(_) | AddMemberResult::AlreadyInGroup) {
            self.data.principal_to_user_id_map.insert(args.principal, args.user_id);
            if let Some(new_joiner_rewards) = &mut self.data.new_joiner_rewards {
                if let Ok(amount) = new_joiner_rewards.try_claim_user_reward(args.user_id, args.now) {
                    ic_cdk::spawn(process_new_joiner_reward(
                        self.env.canister_id(),
                        args.user_id,
                        Cryptocurrency::InternetComputer.ledger_canister_id(),
                        amount,
                        args.now,
                    ));
                }
            }
        }

        result
    }

    pub fn metrics(&self) -> Metrics {
        let group_chat_core = &self.data.chat;
        let now = self.env.now();
        let messages_in_last_hour = group_chat_core
            .events
            .event_count_since(now.saturating_sub(HOUR_IN_MS), now, |e| {
                matches!(e, ChatEventInternal::Message(_))
            }) as u64;
        let messages_in_last_day = group_chat_core
            .events
            .event_count_since(now.saturating_sub(DAY_IN_MS), now, |e| {
                matches!(e, ChatEventInternal::Message(_))
            }) as u64;
        let events_in_last_hour = group_chat_core
            .events
            .event_count_since(now.saturating_sub(HOUR_IN_MS), now, |_| true) as u64;
        let events_in_last_day = group_chat_core
            .events
            .event_count_since(now.saturating_sub(DAY_IN_MS), now, |_| true) as u64;

        Metrics {
            memory_used: utils::memory::used(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public: group_chat_core.is_public,
            date_created: group_chat_core.date_created,
            members: group_chat_core.members.len(),
            moderators: group_chat_core.members.moderator_count(),
            admins: group_chat_core.members.admin_count(),
            owners: group_chat_core.members.owner_count(),
            blocked: group_chat_core.members.blocked().len() as u32,
            invited: self.data.chat.invited_users.len() as u32,
            chat_metrics: group_chat_core.events.metrics().hydrate(),
            messages_in_last_hour,
            messages_in_last_day,
            events_in_last_hour,
            events_in_last_day,
            new_joiner_rewards: self.data.new_joiner_rewards.as_ref().map(|r| r.metrics()),
            frozen: self.data.is_frozen(),
            instruction_counts: self.data.instruction_counts_log.iter().collect(),
            community_being_imported_into: self.data.community_being_imported_into,
            serialized_chat_state_bytes: self
                .data
                .serialized_chat_state
                .as_ref()
                .map(|bytes| bytes.len() as u64)
                .unwrap_or_default(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                notifications: self.data.notifications_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id(),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub chat: GroupChatCore,
    pub principal_to_user_id_map: HashMap<Principal, UserId>,
    pub group_index_canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub invite_code: Option<u64>,
    pub invite_code_enabled: bool,
    pub new_joiner_rewards: Option<NewJoinerRewards>,
    pub frozen: Timestamped<Option<FrozenGroupInfo>>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub activity_notification_state: ActivityNotificationState,
    pub instruction_counts_log: InstructionCountsLog,
    pub test_mode: bool,
    #[serde(default)]
    pub community_being_imported_into: Option<CommunityId>,
    #[serde(default)]
    pub serialized_chat_state: Option<Vec<u8>>,
    #[serde(default)]
    pub synced_gate_with_group_index: bool,
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        is_public: bool,
        name: String,
        description: String,
        rules: AccessRules,
        subtype: Option<GroupSubtype>,
        avatar: Option<Document>,
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
        gate: Option<AccessGate>,
    ) -> Data {
        let chat = GroupChatCore::new(
            creator_user_id,
            is_public,
            name,
            description,
            rules,
            subtype,
            avatar,
            history_visible_to_new_joiners,
            permissions.unwrap_or_default(),
            gate,
            events_ttl,
            now,
        );

        Data {
            chat,
            principal_to_user_id_map: [(creator_principal, creator_user_id)].into_iter().collect(),
            group_index_canister_id,
            local_group_index_canister_id,
            user_index_canister_id,
            local_user_index_canister_id,
            notifications_canister_id,
            proposals_bot_user_id,
            activity_notification_state: ActivityNotificationState::new(now, mark_active_duration),
            test_mode,
            invite_code: None,
            invite_code_enabled: false,
            new_joiner_rewards: None,
            frozen: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            instruction_counts_log: InstructionCountsLog::default(),
            community_being_imported_into: None,
            serialized_chat_state: None,
            synced_gate_with_group_index: false,
        }
    }

    pub fn lookup_user_id(&self, user_id_or_principal: Principal) -> Option<UserId> {
        self.get_member(user_id_or_principal).map(|m| m.user_id)
    }

    pub fn get_member(&self, user_id_or_principal: Principal) -> Option<&GroupMemberInternal> {
        let user_id = self
            .principal_to_user_id_map
            .get(&user_id_or_principal)
            .copied()
            .unwrap_or(user_id_or_principal.into());

        self.chat.members.get(&user_id)
    }

    pub fn get_member_mut(&mut self, user_id_or_principal: Principal) -> Option<&mut GroupMemberInternal> {
        let user_id = self
            .principal_to_user_id_map
            .get(&user_id_or_principal)
            .copied()
            .unwrap_or(user_id_or_principal.into());

        self.chat.members.get_mut(&user_id)
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn is_accessible(&self, caller: Principal, invite_code: Option<u64>) -> bool {
        self.chat.is_public
            || self.get_member(caller).is_some()
            || self.get_invitation(caller).is_some()
            || self.is_invite_code_valid(invite_code)
    }

    pub fn get_invitation(&self, caller: Principal) -> Option<&UserInvitation> {
        self.principal_to_user_id_map
            .get(&caller)
            .and_then(|user_id| self.chat.invited_users.get(user_id))
    }

    pub fn invite_users(
        &mut self,
        invited_by: UserId,
        users: Vec<(UserId, Principal)>,
        now: TimestampMillis,
    ) -> InvitedUsersResult {
        let user_ids: Vec<UserId> = users.iter().map(|(user_id, _)| *user_id).collect();
        let result = self.chat.invite_users(invited_by, user_ids, now);

        if let InvitedUsersResult::Success(success) = &result {
            let invited_users: HashSet<UserId> = success.invited_users.iter().copied().collect();
            for (user_id, principal) in users.into_iter().filter(|(user_id, _)| invited_users.contains(user_id)) {
                self.principal_to_user_id_map.insert(principal, user_id);
            }
        }

        result
    }

    pub fn remove_invitation(&mut self, caller: Principal, now: TimestampMillis) -> Option<UserInvitation> {
        self.principal_to_user_id_map
            .remove(&caller)
            .and_then(|user_id| self.chat.invited_users.remove(&user_id, now))
    }

    pub fn remove_principal(&mut self, user_id: UserId) {
        if let Some(principal) = self
            .principal_to_user_id_map
            .iter()
            .find(|(_, &u)| u == user_id)
            .map(|(p, _)| *p)
        {
            self.principal_to_user_id_map.remove(&principal);
        }
    }

    pub fn record_instructions_count(&self, function_id: InstructionCountFunctionId, now: TimestampMillis) {
        let wasm_version = WASM_VERSION.with(|v| **v.borrow());
        let instructions_count = ic_cdk::api::instruction_counter();

        let _ = self
            .instruction_counts_log
            .record(function_id, instructions_count, wasm_version, now);
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
    pub moderators: u32,
    pub admins: u32,
    pub owners: u32,
    pub blocked: u32,
    pub invited: u32,
    pub chat_metrics: ChatMetrics,
    pub messages_in_last_hour: u64,
    pub messages_in_last_day: u64,
    pub events_in_last_hour: u64,
    pub events_in_last_day: u64,
    pub new_joiner_rewards: Option<NewJoinerRewardMetrics>,
    pub frozen: bool,
    pub instruction_counts: Vec<InstructionCountEntry>,
    pub community_being_imported_into: Option<CommunityId>,
    pub serialized_chat_state_bytes: u64,
    pub canister_ids: CanisterIds,
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

struct AddMemberArgs {
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
