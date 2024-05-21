use crate::memory::{get_instruction_counts_data_memory, get_instruction_counts_index_memory};
use crate::model::channels::Channels;
use crate::model::groups_being_imported::{GroupBeingImportedSummary, GroupsBeingImported};
use crate::model::members::CommunityMembers;
use crate::timer_job_types::{RemoveExpiredEventsJob, TimerJob};
use activity_notification_state::ActivityNotificationState;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use chat_events::ChatMetricsInternal;
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use fire_and_forget_handler::FireAndForgetHandler;
use group_chat_core::AccessRulesInternal;
use group_community_common::{PaymentReceipts, PaymentRecipient, PendingPayment, PendingPaymentReason, PendingPaymentsQueue};
use instruction_counts_log::{InstructionCountEntry, InstructionCountFunctionId, InstructionCountsLog};
use model::{events::CommunityEvents, invited_users::InvitedUsers, members::CommunityMemberInternal};
use msgpack::serialize_then_unwrap;
use notifications_canister::c2c_push_notification;
use rand::rngs::StdRng;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::cell::RefCell;
use std::ops::Deref;
use std::time::Duration;
use types::{
    AccessGate, BuildVersion, CanisterId, ChatMetrics, CommunityCanisterCommunitySummary, CommunityMembership,
    CommunityPermissions, CommunityRole, Cryptocurrency, Cycles, Document, Empty, FrozenGroupInfo, Milliseconds, Notification,
    PaymentGate, Rules, TimestampMillis, Timestamped, UserId,
};
use types::{CommunityId, SNS_FEE_SHARE_PERCENT};
use utils::consts::IC_ROOT_KEY;
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;
use utils::time::MINUTE_IN_MS;

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

    pub fn push_notification(&mut self, recipients: Vec<UserId>, notification: Notification) {
        if !recipients.is_empty() {
            let args = c2c_push_notification::Args {
                recipients,
                authorizer: Some(self.data.local_group_index_canister_id),
                notification_bytes: ByteBuf::from(candid::encode_one(notification).unwrap()),
            };
            ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));
        }

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn queue_access_gate_payments(&mut self, gate: PaymentGate) {
        // The amount available is the gate amount less the approval fee and the transfer_from fee
        let amount_available = gate.amount - 2 * gate.fee;
        // Queue a payment to each owner less the fee
        let owners: Vec<UserId> = self
            .data
            .members
            .iter()
            .filter(|m| matches!(m.role, CommunityRole::Owner))
            .map(|m| m.user_id)
            .collect();

        let owner_count = owners.len() as u128;
        let owner_share = (amount_available * (100 - SNS_FEE_SHARE_PERCENT) / 100) / owner_count;
        let amount = owner_share.saturating_sub(gate.fee);
        if amount > 0 {
            for owner in owners {
                self.data.pending_payments_queue.push(PendingPayment {
                    amount,
                    fee: gate.fee,
                    ledger_canister: gate.ledger_canister_id,
                    recipient: PaymentRecipient::Member(owner),
                    reason: PendingPaymentReason::AccessGate,
                });
            }
        }

        // Queue the remainder to the treasury less the fee
        let treasury_share = amount_available.saturating_sub(owner_share * owner_count);
        let amount = treasury_share.saturating_sub(gate.fee);
        if amount > 0 {
            self.data.pending_payments_queue.push(PendingPayment {
                amount,
                fee: gate.fee,
                ledger_canister: gate.ledger_canister_id,
                recipient: PaymentRecipient::Treasury,
                reason: PendingPaymentReason::AccessGate,
            });
        }

        jobs::make_pending_payments::start_job_if_required(self);
    }

    pub fn summary(&self, member: Option<&CommunityMemberInternal>) -> CommunityCanisterCommunitySummary {
        let data = &self.data;

        let (channels, membership) = if let Some(m) = member {
            let membership = CommunityMembership {
                joined: m.date_added,
                role: m.role,
                rules_accepted: m
                    .rules_accepted
                    .as_ref()
                    .map_or(false, |version| version.value >= self.data.rules.text.version),
                display_name: m.display_name().value.clone(),
            };

            // Return all the channels that the user is a member of
            let channels: Vec<_> = m
                .channels
                .iter()
                .filter_map(|c| self.data.channels.get(c))
                .filter_map(|c| c.summary(Some(m.user_id), true, data.is_public, &data.members))
                .collect();

            (channels, Some(membership))
        } else {
            // Return all public channels
            let channels: Vec<_> = self
                .data
                .channels
                .public_channels()
                .iter()
                .filter_map(|c| c.summary(None, false, data.is_public, &data.members))
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
            user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
            metrics: data.cached_chat_metrics.value.clone(),
        }
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        let mut next_event_expiry = None;
        for channel in self.data.channels.iter_mut() {
            channel.chat.remove_expired_events(now);
            if let Some(expiry) = channel.chat.events.next_event_expiry() {
                if next_event_expiry.map_or(true, |current| expiry < current) {
                    next_event_expiry = Some(expiry);
                }
            }
        }

        self.data.next_event_expiry = next_event_expiry;
        if let Some(expiry) = self.data.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
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
            public: self.data.is_public,
            date_created: self.data.date_created,
            members: self.data.members.len(),
            admins: self.data.members.admin_count(),
            owners: self.data.members.owner_count(),
            blocked: self.data.members.blocked().len() as u32,
            invited: self.data.invited_users.len() as u32,
            frozen: self.data.is_frozen(),
            groups_being_imported: self.data.groups_being_imported.summaries(),
            instruction_counts: self.data.instruction_counts_log.iter().collect(),
            event_store_client_info: self.data.event_store_client.info(),
            timer_jobs: self.data.timer_jobs.len() as u32,
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
}

fn init_instruction_counts_log() -> InstructionCountsLog {
    InstructionCountsLog::init(get_instruction_counts_index_memory(), get_instruction_counts_data_memory())
}

#[derive(Serialize, Deserialize)]
struct Data {
    is_public: bool,
    name: String,
    description: String,
    rules: AccessRulesInternal,
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
    escrow_canister_id: CanisterId,
    #[serde(default = "internet_identity_canister_id")]
    internet_identity_canister_id: CanisterId,
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
    #[serde(skip, default = "init_instruction_counts_log")]
    instruction_counts_log: InstructionCountsLog,
    next_event_expiry: Option<TimestampMillis>,
    video_call_operators: Vec<Principal>,
    test_mode: bool,
    cached_chat_metrics: Timestamped<ChatMetrics>,
    rng_seed: [u8; 32],
    pending_payments_queue: PendingPaymentsQueue,
    total_payment_receipts: PaymentReceipts,
    #[serde(default = "ic_root_key")]
    ic_root_key: Vec<u8>,
    event_store_client: EventStoreClient<CdkRuntime>,
}

fn internet_identity_canister_id() -> CanisterId {
    CanisterId::from_text("rdmx6-jaaaa-aaaaa-aaadq-cai").unwrap()
}

fn ic_root_key() -> Vec<u8> {
    IC_ROOT_KEY.to_vec()
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        community_id: CommunityId,
        created_by_principal: Principal,
        created_by_user_id: UserId,
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
        gate: Option<AccessGate>,
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
            default_channels,
            default_channel_rules,
            is_public,
            rng,
            now,
        );
        let members = CommunityMembers::new(created_by_principal, created_by_user_id, channels.public_channel_ids(), now);
        let events = CommunityEvents::new(name.clone(), description.clone(), created_by_user_id, now);

        Data {
            is_public,
            name,
            description,
            rules: AccessRulesInternal::new(rules),
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
            escrow_canister_id,
            internet_identity_canister_id,
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
        }
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn is_accessible(&self, caller: Principal, invite_code: Option<u64>) -> bool {
        self.is_public
            || self.members.get(caller).is_some()
            || self
                .members
                .lookup_user_id(caller)
                .map_or(false, |u| self.invited_users.get(&u).is_some())
            || self.is_invite_code_valid(invite_code)
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
            self.members.user_groups_last_updated(),
            self.members.display_names_last_updated(),
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn has_payment_gate(&self) -> bool {
        self.gate
            .value
            .as_ref()
            .map(|g| matches!(g, AccessGate::Payment(_)))
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
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
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
    pub instruction_counts: Vec<InstructionCountEntry>,
    pub event_store_client_info: EventStoreClientInfo,
    pub timer_jobs: u32,
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
