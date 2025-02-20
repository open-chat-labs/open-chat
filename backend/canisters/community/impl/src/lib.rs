use crate::memory::{get_instruction_counts_data_memory, get_instruction_counts_index_memory};
use crate::model::channels::Channels;
use crate::model::groups_being_imported::{GroupBeingImportedSummary, GroupsBeingImported};
use crate::model::members::CommunityMembers;
use crate::timer_job_types::{DeleteFileReferencesJob, MakeTransferJob, RemoveExpiredEventsJob, TimerJob};
use activity_notification_state::ActivityNotificationState;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{ChatEventInternal, ChatMetricsInternal};
use community_canister::add_members_to_channel::UserFailedError;
use community_canister::EventsResponse;
use constants::{ICP_LEDGER_CANISTER_ID, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID, SNS_LEDGER_CANISTER_ID};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use fire_and_forget_handler::FireAndForgetHandler;
use gated_groups::GatePayment;
use group_chat_core::{AccessRulesInternal, AddResult, BotApiKeys};
use group_community_common::{
    Achievements, ExpiringMember, ExpiringMemberActions, ExpiringMembers, GroupBots, Members, PaymentReceipts,
    PaymentRecipient, PendingPayment, PendingPaymentReason, PendingPaymentsQueue, UserCache,
};
use instruction_counts_log::{InstructionCountEntry, InstructionCountFunctionId, InstructionCountsLog};
use model::events::CommunityEventInternal;
use model::user_event_batch::UserEventBatch;
use model::{events::CommunityEvents, invited_users::InvitedUsers, members::CommunityMemberInternal};
use msgpack::serialize_then_unwrap;
use notifications_canister::c2c_push_notification;
use rand::rngs::StdRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use stable_memory_map::{BaseKeyPrefix, ChatEventKeyPrefix};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use std::ops::Deref;
use std::time::Duration;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    AccessGate, AccessGateConfigInternal, Achievement, BotAdded, BotCaller, BotGroupConfig, BotInitiator, BotPermissions,
    BotRemoved, BotUpdated, BuildVersion, Caller, CanisterId, ChannelId, ChatMetrics, CommunityCanisterCommunitySummary,
    CommunityMembership, CommunityPermissions, Cryptocurrency, Cycles, Document, Empty, FrozenGroupInfo, GroupRole,
    MembersAdded, Milliseconds, Notification, Rules, TimestampMillis, Timestamped, UserId, UserType,
};
use types::{CommunityId, SNS_FEE_SHARE_PERCENT};
use user_canister::CommunityCanisterEvent;
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
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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

    pub fn is_caller_escrow_canister(&self) -> bool {
        self.env.caller() == self.data.escrow_canister_id
    }

    pub fn is_caller_video_call_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.video_call_operators.iter().any(|o| *o == caller)
    }

    pub fn push_notification(&mut self, sender: Option<UserId>, recipients: Vec<UserId>, notification: Notification) {
        if !recipients.is_empty() {
            let args = c2c_push_notification::Args {
                sender,
                recipients,
                authorizer: Some(self.data.local_group_index_canister_id),
                notification_bytes: ByteBuf::from(serialize_then_unwrap(notification)),
            };
            ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));
        }

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn queue_access_gate_payments(&mut self, payment: GatePayment) {
        // Queue a payment to each owner less the fee
        let owners = self.data.members.owners();

        let owner_count = owners.len() as u128;
        let owner_share = (payment.amount * (100 - SNS_FEE_SHARE_PERCENT) / 100) / owner_count;
        if owner_share > payment.fee {
            for owner in owners {
                self.data.pending_payments_queue.push(PendingPayment {
                    amount: owner_share,
                    fee: payment.fee,
                    ledger_canister: payment.ledger_canister_id,
                    recipient: PaymentRecipient::Member(*owner),
                    reason: PendingPaymentReason::AccessGate,
                });
            }
        }

        // Queue the remainder to the treasury less the fee
        let treasury_share = payment.amount.saturating_sub(owner_share * owner_count);
        let amount = treasury_share.saturating_sub(payment.fee);
        if amount > 0 {
            let is_chat = payment.ledger_canister_id == SNS_LEDGER_CANISTER_ID;
            let is_icp = payment.ledger_canister_id == ICP_LEDGER_CANISTER_ID;
            self.data.pending_payments_queue.push(PendingPayment {
                amount,
                fee: if is_chat { 0 } else { payment.fee }, // No fee for BURNing
                ledger_canister: payment.ledger_canister_id,
                recipient: if is_chat || is_icp { PaymentRecipient::SnsTreasury } else { PaymentRecipient::TreasuryCanister },
                reason: PendingPaymentReason::AccessGate,
            });
        }

        jobs::make_pending_payments::start_job_if_required(self);
    }

    pub fn summary(
        &self,
        member: Option<&CommunityMemberInternal>,
        is_invited: Option<bool>,
    ) -> CommunityCanisterCommunitySummary {
        let data = &self.data;

        let (channels, membership) = if let Some(m) = member {
            let membership = CommunityMembership {
                joined: m.date_added,
                role: m.role(),
                rules_accepted: m
                    .rules_accepted
                    .as_ref()
                    .is_some_and(|version| version.value >= self.data.rules.text.version),
                display_name: m.display_name().value.clone(),
                lapsed: m.lapsed().value,
            };

            // Return all the channels that the user is a member of
            let channels: Vec<_> = self
                .data
                .members
                .channels_for_member(m.user_id)
                .iter()
                .filter_map(|c| self.data.channels.get(c))
                .filter_map(|c| c.summary(Some(m.user_id), true, data.is_public.value, &data.members))
                .collect();

            (channels, Some(membership))
        } else {
            // Return all public channels
            let channels: Vec<_> = self
                .data
                .channels
                .public_channels()
                .iter()
                .filter_map(|c| c.summary(None, false, data.is_public.value, &data.members))
                .collect();

            (channels, None)
        };

        let last_updated = [
            member.map(|m| m.last_updated()).unwrap_or_default(),
            self.data.events.latest_event_timestamp(),
            self.data.members.user_groups_last_updated(),
        ]
        .into_iter()
        .chain(channels.iter().map(|c| c.last_updated))
        .max()
        .unwrap_or_default();

        CommunityCanisterCommunitySummary {
            community_id: self.env.canister_id().into(),
            local_user_index_canister_id: self.data.local_user_index_canister_id,
            last_updated,
            name: data.name.value.clone(),
            description: data.description.value.clone(),
            avatar_id: Document::id(&data.avatar),
            banner_id: Document::id(&data.banner),
            is_public: data.is_public.value,
            latest_event_index: data.events.latest_event_index(),
            member_count: data.members.len() as u32,
            permissions: data.permissions.value.clone(),
            frozen: data.frozen.value.clone(),
            gate: data.gate_config.value.as_ref().map(|gc| gc.gate.clone()),
            gate_config: data.gate_config.value.clone().map(|gc| gc.into()),
            primary_language: data.primary_language.value.clone(),
            channels,
            membership,
            user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
            is_invited,
            metrics: data.cached_chat_metrics.value.clone(),
            verified: data.verified.value,
        }
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        let mut next_event_expiry = None;
        let mut files_to_delete = Vec::new();
        let mut final_prize_payments = Vec::new();
        for channel in self.data.channels.iter_mut() {
            let result = channel.chat.remove_expired_events(now);
            if let Some(expiry) = channel.chat.events.next_event_expiry() {
                if next_event_expiry.map_or(true, |current| expiry < current) {
                    next_event_expiry = Some(expiry);
                }
            }
            files_to_delete.extend(result.files);
            final_prize_payments.extend(result.final_prize_payments);
            for thread in result.threads {
                self.data.stable_memory_keys_to_garbage_collect.push(BaseKeyPrefix::from(
                    ChatEventKeyPrefix::new_from_channel(channel.id, Some(thread.root_message_index)),
                ));
            }
        }
        jobs::garbage_collect_stable_memory::start_job_if_required(self);

        self.data.next_event_expiry = next_event_expiry;
        if let Some(expiry) = self.data.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
        if !files_to_delete.is_empty() {
            let delete_files_job = DeleteFileReferencesJob { files: files_to_delete };
            delete_files_job.execute();
        }
        for pending_transaction in final_prize_payments {
            self.data.timer_jobs.enqueue_job(
                TimerJob::MakeTransfer(MakeTransferJob {
                    pending_transaction,
                    attempt: 0,
                }),
                now,
                now,
            );
        }
    }

    pub fn generate_channel_id(&mut self) -> ChannelId {
        loop {
            let channel_id = self.env.rng().next_u32().into();
            if self.data.channels.get(&channel_id).is_none() {
                return channel_id;
            }
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public: self.data.is_public.value,
            date_created: self.data.date_created,
            channels: self.data.channels.len() as u32,
            members: self.data.members.len() as u32,
            admins: self.data.members.admins().len() as u32,
            owners: self.data.members.owners().len() as u32,
            blocked: self.data.members.blocked().len() as u32,
            invited: self.data.invited_users.len() as u32,
            frozen: self.data.is_frozen(),
            groups_being_imported: self.data.groups_being_imported.summaries(),
            instruction_counts: self.data.instruction_counts_log.iter().collect(),
            event_store_client_info: self.data.event_store_client.info(),
            timer_jobs: self.data.timer_jobs.len() as u32,
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                notifications: self.data.notifications_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                escrow: self.data.escrow_canister_id,
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
                internet_identity: self.data.internet_identity_canister_id,
            },
        }
    }

    pub fn verified_caller(&self, bot_caller: Option<BotCaller>) -> CallerResult {
        use CallerResult::*;

        if let Some(bot_caller) = bot_caller {
            if let Some(initiator) = &bot_caller.initiator.user() {
                // Check the user who initiated the command is a valid member
                let Some(member) = self.data.members.get_by_user_id(initiator) else {
                    return NotFound;
                };

                if member.suspended().value {
                    return Suspended;
                } else if member.lapsed().value {
                    return Lapsed;
                }
            }

            return Success(Caller::BotV2(bot_caller));
        }

        let caller = self.env.caller();

        if caller == self.data.user_index_canister_id {
            return Success(Caller::OCBot(OPENCHAT_BOT_USER_ID));
        }

        let Some(member) = self.data.members.get(caller) else {
            return NotFound;
        };

        if member.suspended().value {
            return Suspended;
        } else if member.lapsed().value {
            return Lapsed;
        }

        match member.user_type {
            UserType::User => Success(Caller::User(member.user_id)),
            UserType::BotV2 => NotFound,
            UserType::Bot => Success(Caller::Bot(member.user_id)),
            UserType::OcControlledBot => Success(Caller::OCBot(member.user_id)),
        }
    }
}

fn init_instruction_counts_log() -> InstructionCountsLog {
    InstructionCountsLog::init(get_instruction_counts_index_memory(), get_instruction_counts_data_memory())
}

#[derive(Serialize, Deserialize)]
struct Data {
    is_public: Timestamped<bool>,
    name: Timestamped<String>,
    description: Timestamped<String>,
    rules: Timestamped<AccessRulesInternal>,
    avatar: Timestamped<Option<Document>>,
    banner: Timestamped<Option<Document>>,
    permissions: Timestamped<CommunityPermissions>,
    gate_config: Timestamped<Option<AccessGateConfigInternal>>,
    primary_language: Timestamped<String>,
    user_index_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    group_index_canister_id: CanisterId,
    local_group_index_canister_id: CanisterId,
    notifications_canister_id: CanisterId,
    proposals_bot_user_id: UserId,
    escrow_canister_id: CanisterId,
    internet_identity_canister_id: CanisterId,
    date_created: TimestampMillis,
    members: CommunityMembers,
    channels: Channels,
    events: CommunityEvents,
    invited_users: InvitedUsers,
    invite_code: Timestamped<Option<u64>>,
    invite_code_enabled: Timestamped<bool>,
    frozen: Timestamped<Option<FrozenGroupInfo>>,
    timer_jobs: TimerJobs<TimerJob>,
    fire_and_forget_handler: FireAndForgetHandler,
    activity_notification_state: ActivityNotificationState,
    groups_being_imported: GroupsBeingImported,
    #[serde(skip, default = "init_instruction_counts_log")]
    instruction_counts_log: InstructionCountsLog,
    next_event_expiry: Option<TimestampMillis>,
    video_call_operators: Vec<Principal>,
    test_mode: bool,
    cached_chat_metrics: Timestamped<ChatMetrics>,
    rng_seed: [u8; 32],
    pending_payments_queue: PendingPaymentsQueue,
    total_payment_receipts: PaymentReceipts,
    #[serde(with = "serde_bytes")]
    ic_root_key: Vec<u8>,
    event_store_client: EventStoreClient<CdkRuntime>,
    achievements: Achievements,
    expiring_members: ExpiringMembers,
    expiring_member_actions: ExpiringMemberActions,
    user_cache: UserCache,
    user_event_sync_queue: GroupedTimerJobQueue<UserEventBatch>,
    stable_memory_keys_to_garbage_collect: Vec<BaseKeyPrefix>,
    bots: GroupBots,
    bot_api_keys: BotApiKeys,
    verified: Timestamped<bool>,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        community_id: CommunityId,
        created_by_principal: Principal,
        created_by_user_id: UserId,
        created_by_user_type: UserType,
        is_public: bool,
        name: String,
        description: String,
        rules: Rules,
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
        escrow_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        gate: Option<AccessGateConfigInternal>,
        default_channels: Vec<String>,
        default_channel_rules: Option<Rules>,
        mark_active_duration: Milliseconds,
        video_call_operators: Vec<Principal>,
        ic_root_key: Vec<u8>,
        test_mode: bool,
        rng: &mut StdRng,
        now: TimestampMillis,
    ) -> Data {
        let channels = Channels::new(
            community_id,
            created_by_user_id,
            created_by_user_type,
            default_channels,
            default_channel_rules,
            is_public,
            rng,
            now,
        );
        let members = CommunityMembers::new(
            created_by_principal,
            created_by_user_id,
            created_by_user_type,
            channels.public_channel_ids(),
            now,
        );
        let events = CommunityEvents::new(name.clone(), description.clone(), created_by_user_id, now);

        Data {
            is_public: Timestamped::new(is_public, now),
            name: Timestamped::new(name, now),
            description: Timestamped::new(description, now),
            rules: Timestamped::new(AccessRulesInternal::new(rules), now),
            avatar: Timestamped::new(avatar, now),
            banner: Timestamped::new(banner, now),
            permissions: Timestamped::new(permissions, now),
            gate_config: Timestamped::new(gate, now),
            primary_language: Timestamped::new(primary_language, now),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            local_group_index_canister_id,
            notifications_canister_id,
            proposals_bot_user_id,
            escrow_canister_id,
            internet_identity_canister_id,
            date_created: now,
            members,
            channels,
            events,
            invited_users: InvitedUsers::default(),
            invite_code: Timestamped::default(),
            invite_code_enabled: Timestamped::default(),
            frozen: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            activity_notification_state: ActivityNotificationState::new(now, mark_active_duration),
            groups_being_imported: GroupsBeingImported::default(),
            instruction_counts_log: init_instruction_counts_log(),
            next_event_expiry: None,
            test_mode,
            cached_chat_metrics: Timestamped::default(),
            rng_seed: [0; 32],
            pending_payments_queue: PendingPaymentsQueue::default(),
            total_payment_receipts: PaymentReceipts::default(),
            video_call_operators,
            ic_root_key,
            event_store_client: EventStoreClientBuilder::new(local_group_index_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_millis(5 * MINUTE_IN_MS))
                .build(),
            achievements: Achievements::default(),
            expiring_members: ExpiringMembers::default(),
            expiring_member_actions: ExpiringMemberActions::default(),
            user_cache: UserCache::default(),
            user_event_sync_queue: GroupedTimerJobQueue::new(5, true),
            stable_memory_keys_to_garbage_collect: Vec::new(),
            bots: GroupBots::default(),
            bot_api_keys: BotApiKeys::default(),
            verified: Timestamped::default(),
        }
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn is_accessible(&self, caller: Principal, invite_code: Option<u64>) -> bool {
        self.is_public.value
            || self.members.get(caller).is_some()
            || self.is_invited(caller)
            || self.is_invite_code_valid(invite_code)
    }

    pub fn is_invited(&self, caller: Principal) -> bool {
        self.members
            .lookup_user_id(caller)
            .is_some_and(|u| self.invited_users.get(&u).is_some())
    }

    pub fn build_chat_metrics(&mut self, now: TimestampMillis) {
        let mut metrics = ChatMetricsInternal::default();

        for channel in self.channels.iter().filter(|c| c.chat.is_public.value) {
            metrics.merge(channel.chat.events.metrics());
        }

        self.cached_chat_metrics = Timestamped::new(metrics.hydrate(), now);
    }

    pub fn record_instructions_count(&self, function_id: InstructionCountFunctionId, now: TimestampMillis) {
        let wasm_version = WASM_VERSION.with_borrow(|v| **v);
        let instructions_count = ic_cdk::api::instruction_counter();

        let _ = self
            .instruction_counts_log
            .record(function_id, instructions_count, wasm_version, now);
    }

    pub fn mark_community_updated_in_user_canister(&self, user_id: UserId) {
        self.fire_and_forget_handler.send(
            user_id.into(),
            "c2c_mark_community_updated_for_user_msgpack".to_string(),
            serialize_then_unwrap(Empty {}),
        );
    }

    pub fn details_last_updated(&self) -> TimestampMillis {
        [
            self.invited_users.last_updated(),
            self.events.latest_event_timestamp(),
            self.members.last_updated(),
            self.bots.last_updated(),
            self.bot_api_keys.last_updated(),
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn has_payment_gate(&self) -> bool {
        self.gate_config
            .value
            .as_ref()
            .map(|g| matches!(g.gate, AccessGate::Payment(_)))
            .unwrap_or_default()
    }

    pub fn handle_event_expiry(&mut self, expiry: TimestampMillis, now: TimestampMillis) {
        if self.next_event_expiry.map_or(true, |ex| expiry < ex) {
            self.next_event_expiry = Some(expiry);

            let timer_jobs = &mut self.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
            timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn is_invite_code_valid(&self, invite_code: Option<u64>) -> bool {
        if self.invite_code_enabled.value {
            if let Some(provided_code) = invite_code {
                if let Some(stored_code) = self.invite_code.value {
                    return provided_code == stored_code;
                }
            }
        }

        false
    }

    pub fn remove_user_from_community(
        &mut self,
        user_id: UserId,
        principal: Option<Principal>,
        now: TimestampMillis,
    ) -> Option<CommunityMemberInternal> {
        let removed = self.members.remove(user_id, principal, now);
        self.channels.leave_all_channels(user_id, now);
        self.expiring_members.remove_member(user_id, None);
        self.expiring_member_actions.remove_member(user_id, None);
        self.achievements.remove_user(&user_id);
        self.user_cache.delete(user_id);
        removed
    }

    pub fn remove_user_from_channel(&mut self, user_id: UserId, channel_id: ChannelId, now: TimestampMillis) {
        self.members.mark_member_left_channel(user_id, channel_id, false, now);
        self.expiring_members.remove_member(user_id, Some(channel_id));
        self.expiring_member_actions.remove_member(user_id, Some(channel_id));
    }

    fn can_member_lapse(&self, user_id: &UserId, channel_id: Option<ChannelId>) -> bool {
        if let Some(channel_id) = channel_id {
            self.channels
                .get(&channel_id)
                .is_some_and(|c| c.chat.members.can_member_lapse(user_id))
        } else {
            self.members.can_member_lapse(user_id)
        }
    }

    pub fn update_lapsed(&mut self, user_id: UserId, channel_id: Option<ChannelId>, lapsed: bool, now: TimestampMillis) {
        if let Some(channel_id) = channel_id {
            if let Some(channel) = self.channels.get_mut(&channel_id) {
                channel.chat.members.update_lapsed(user_id, lapsed, now);
            }
        } else {
            self.members.update_lapsed(user_id, lapsed, now);
        }
    }

    pub fn unlapse_all(&mut self, channel_id: Option<ChannelId>, now: TimestampMillis) {
        if let Some(channel_id) = channel_id {
            if let Some(channel) = self.channels.get_mut(&channel_id) {
                channel.chat.members.unlapse_all(now);
            }
        } else {
            self.members.unlapse_all(now);
        }
    }

    pub fn update_member_expiry(
        &mut self,
        channel_id: Option<ChannelId>,
        prev_gate_config: &Option<AccessGateConfigInternal>,
        now: TimestampMillis,
    ) {
        let prev_gate_expiry = prev_gate_config.as_ref().and_then(|gc| gc.expiry());
        let new_gate_config = self.get_access_gate_config(channel_id);
        let new_gate_expiry = new_gate_config.and_then(|gc| gc.expiry());

        if let Some(prev_gate_expiry) = prev_gate_expiry {
            if let Some(new_gate_expiry) = new_gate_expiry {
                // If there is also a new expiring gate then update the expiry schedule of members if necessary
                self.expiring_members
                    .change_gate_expiry(channel_id, new_gate_expiry as i64 - prev_gate_expiry as i64);
            } else {
                // If the access gate has been removed then clear lapsed status of members
                if new_gate_config.is_none() {
                    self.unlapse_all(channel_id, now);
                }

                // There is no expiring gate any longer so remove the expiring members
                self.expiring_members.remove_gate(channel_id);
                self.expiring_member_actions.remove_gate(channel_id);
            }
        } else if let Some(new_gate_expiry) = new_gate_expiry {
            // Else if the new gate has an expiry then add members to the expiry schedule.
            let user_ids_iter = if let Some(channel_id) = channel_id {
                if let Some(channel) = self.channels.get_mut(&channel_id) {
                    channel.chat.members.iter_members_who_can_lapse()
                } else {
                    Box::new(std::iter::empty())
                }
            } else {
                self.members.iter_members_who_can_lapse()
            };

            for user_id in user_ids_iter {
                self.expiring_members.push(ExpiringMember {
                    expires: now + new_gate_expiry,
                    channel_id,
                    user_id,
                });
            }
        }
    }

    pub fn get_access_gate_config(&self, channel_id: Option<ChannelId>) -> Option<&AccessGateConfigInternal> {
        if let Some(channel_id) = channel_id {
            self.channels
                .get(&channel_id)
                .and_then(|channel| channel.chat.gate_config.value.as_ref())
        } else {
            self.gate_config.value.as_ref()
        }
    }

    pub fn get_member_for_events(&self, caller: Principal) -> Result<Option<CommunityMemberInternal>, EventsResponse> {
        let hidden_for_non_members = !self.is_public.value || self.has_payment_gate();
        let member = self.members.get(caller);

        if hidden_for_non_members {
            if let Some(member) = &member {
                if member.suspended().value {
                    return Err(EventsResponse::UserSuspended);
                } else if member.lapsed().value {
                    return Err(EventsResponse::UserLapsed);
                }
            } else {
                return Err(EventsResponse::UserNotInCommunity);
            }
        }

        Ok(member)
    }

    pub fn notify_user_of_achievement(&mut self, user_id: UserId, achievement: Achievement) {
        if self.achievements.award(user_id, achievement).is_some() {
            self.user_event_sync_queue
                .push(user_id, CommunityCanisterEvent::Achievement(achievement));
        }
    }

    pub fn add_members_to_channel(
        &mut self,
        channel_id: &ChannelId,
        users_to_add: Vec<(UserId, UserType)>,
        added_by: UserId,
        now: TimestampMillis,
    ) -> AddUsersToChannelResult {
        let mut channel_name = None;
        let mut channel_avatar_id = None;
        let mut users_failed_with_error: Vec<UserFailedError> = Vec::new();
        let mut users_added: Vec<UserId> = Vec::new();
        let mut users_already_in_channel: Vec<UserId> = Vec::new();
        let mut users_limit_reached: Vec<UserId> = Vec::new();

        if let Some(channel) = self.channels.get_mut(channel_id) {
            let (min_visible_event_index, min_visible_message_index) = channel.chat.min_visible_indexes_for_new_members();

            let gate_expiry = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry());

            for (user_id, user_type) in users_to_add {
                match channel.chat.members.add(
                    user_id,
                    now,
                    min_visible_event_index,
                    min_visible_message_index,
                    channel.chat.is_public.value,
                    user_type,
                ) {
                    AddResult::Success(_) => {
                        self.members.mark_member_joined_channel(user_id, channel.id);

                        if !matches!(user_type, UserType::BotV2) {
                            users_added.push(user_id);
                        }

                        if !user_type.is_bot() {
                            if let Some(gate_expiry) = gate_expiry {
                                self.expiring_members.push(ExpiringMember {
                                    expires: now + gate_expiry,
                                    channel_id: Some(channel.id),
                                    user_id,
                                });
                            }
                        }
                    }
                    AddResult::AlreadyInGroup => users_already_in_channel.push(user_id),
                    AddResult::MemberLimitReached(_) => users_limit_reached.push(user_id),
                    AddResult::Blocked => users_failed_with_error.push(UserFailedError {
                        user_id,
                        error: "User blocked".to_string(),
                    }),
                }
            }

            if !users_added.is_empty() {
                let event = MembersAdded {
                    user_ids: users_added.clone(),
                    added_by,
                    unblocked: Vec::new(),
                };

                channel
                    .chat
                    .events
                    .push_main_event(ChatEventInternal::ParticipantsAdded(Box::new(event)), 0, now);
            }

            channel_name = Some(channel.chat.name.value.clone());
            channel_avatar_id = channel.chat.avatar.as_ref().map(|d| d.id);
        }

        AddUsersToChannelResult {
            channel_name,
            channel_avatar_id,
            users_failed_with_error,
            users_added,
            users_already_in_channel,
            users_limit_reached,
        }
    }

    pub fn install_bot(&mut self, owner_id: UserId, user_id: UserId, bot_config: BotGroupConfig, now: TimestampMillis) -> bool {
        if !self.bots.add(user_id, owner_id, bot_config.permissions, now) {
            return false;
        }

        // Publish community event
        self.events.push_event(
            CommunityEventInternal::BotAdded(Box::new(BotAdded {
                user_id,
                added_by: owner_id,
            })),
            now,
        );

        true
    }

    pub fn update_bot(&mut self, owner_id: UserId, user_id: UserId, bot_config: BotGroupConfig, now: TimestampMillis) -> bool {
        if !self.bots.update(user_id, bot_config.permissions, now) {
            return false;
        }

        // Publish community event
        self.events.push_event(
            CommunityEventInternal::BotUpdated(Box::new(BotUpdated {
                user_id,
                updated_by: owner_id,
            })),
            now,
        );

        true
    }

    pub fn uninstall_bot(&mut self, owner_id: UserId, user_id: UserId, now: TimestampMillis) -> bool {
        if !self.bots.remove(user_id, now) {
            return false;
        }

        // Publish community event
        self.events.push_event(
            CommunityEventInternal::BotRemoved(Box::new(BotRemoved {
                user_id,
                removed_by: owner_id,
            })),
            now,
        );

        // TODO: Notify UserIndex

        true
    }

    pub fn get_user_permissions(&self, user_id: &UserId, channel_id: Option<ChannelId>) -> Option<BotPermissions> {
        let community_member = self.members.get_by_user_id(user_id)?;

        if community_member.suspended().value || community_member.lapsed().value {
            return None;
        }

        let community_permissions = community_member.role().permissions(&self.permissions);

        let mut bot_permissions = BotPermissions {
            community: community_permissions,
            chat: HashSet::new(),
            message: HashSet::new(),
        };

        if let Some(channel_id) = channel_id {
            let channel = self.channels.get(&channel_id)?;
            let channel_member = channel.chat.members.get_verified_member(*user_id).ok()?;

            let channel_permissions = channel_member.role().permissions(&channel.chat.permissions);
            let message_permissions = channel_member
                .role()
                .message_permissions(&channel.chat.permissions.message_permissions);

            bot_permissions.chat = channel_permissions;
            bot_permissions.message = message_permissions;
        }

        Some(bot_permissions)
    }

    pub fn get_api_key_permissions(
        &self,
        bot_id: &UserId,
        secret: &str,
        channel_id: Option<ChannelId>,
    ) -> Option<&BotPermissions> {
        let permissions = if let Some(channel_id) = channel_id {
            let channel = self.channels.get(&channel_id)?;
            channel.bot_api_keys.permissions_if_secret_matches(bot_id, secret)
        } else {
            None
        };

        permissions.or_else(|| self.bot_api_keys.permissions_if_secret_matches(bot_id, secret))
    }

    pub fn is_bot_permitted(
        &self,
        bot_id: &UserId,
        channel_id: Option<ChannelId>,
        initiator: &BotInitiator,
        required: BotPermissions,
    ) -> bool {
        // Try to get the installed bot
        let Some(bot) = self.bots.get(bot_id) else {
            return false;
        };

        // Get the permissions granted to the bot when initiated by command or API key
        let granted_to_bot = match initiator {
            BotInitiator::Command(_) => &bot.permissions,
            BotInitiator::ApiKeySecret(secret) => match self.get_api_key_permissions(bot_id, secret, channel_id) {
                Some(bot_permissions) => bot_permissions,
                None => return false,
            },
            BotInitiator::ApiKeyPermissions(permissions) => permissions,
        };

        // If the bot is the owner of the channel then grant all chat permissions
        let granted_to_bot =
            if channel_id.is_some_and(|channel_id| self.is_same_or_senior_in_channel(bot_id, &channel_id, GroupRole::Owner)) {
                &BotPermissions::union(granted_to_bot, &BotPermissions::chat_owner())
            } else {
                granted_to_bot
            };

        // If this is a command initiated by a user then intersect the permissions granted to the bot with the user's permissions
        let granted = match initiator {
            BotInitiator::Command(command) => match self.get_user_permissions(&command.initiator, channel_id) {
                Some(user_permissions) => &BotPermissions::intersect(granted_to_bot, &user_permissions),
                None => return false,
            },
            _ => granted_to_bot,
        };

        // The permissions required must be a subset of the permissions granted to the bot
        required.is_subset(granted)
    }

    pub fn is_same_or_senior_in_channel(&self, user_id: &UserId, channel_id: &ChannelId, role: GroupRole) -> bool {
        self.channels
            .get(channel_id)
            .and_then(|channel| channel.chat.members.get(user_id))
            .is_some_and(|member| member.role().is_same_or_senior(role.into()))
    }

    pub fn is_same_or_senior(&self, user_id_or_principal: Principal, channel_id: Option<ChannelId>, role: GroupRole) -> bool {
        let Some(community_member) = self.members.get(user_id_or_principal) else {
            return false;
        };

        if let Some(channel_id) = channel_id {
            self.is_same_or_senior_in_channel(&community_member.user_id, &channel_id, role)
        } else {
            community_member.role().is_same_or_senior(role.into())
        }
    }
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub public: bool,
    pub date_created: TimestampMillis,
    pub channels: u32,
    pub members: u32,
    pub admins: u32,
    pub owners: u32,
    pub blocked: u32,
    pub invited: u32,
    pub frozen: bool,
    pub groups_being_imported: Vec<GroupBeingImportedSummary>,
    pub instruction_counts: Vec<InstructionCountEntry>,
    pub event_store_client_info: EventStoreClientInfo,
    pub timer_jobs: u32,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
    pub proposals_bot: CanisterId,
    pub escrow: CanisterId,
    pub icp_ledger: CanisterId,
    pub internet_identity: CanisterId,
}

pub struct AddUsersToChannelResult {
    pub channel_name: Option<String>,
    pub channel_avatar_id: Option<u128>,
    pub users_failed_with_error: Vec<UserFailedError>,
    pub users_added: Vec<UserId>,
    pub users_already_in_channel: Vec<UserId>,
    pub users_limit_reached: Vec<UserId>,
}

pub enum CallerResult {
    Success(Caller),
    NotFound,
    Suspended,
    Lapsed,
}
