use crate::memory::{get_instruction_counts_data_memory, get_instruction_counts_index_memory};
use crate::model::new_joiner_rewards::{NewJoinerRewardMetrics, NewJoinerRewardStatus, NewJoinerRewards};
use crate::new_joiner_rewards::process_new_joiner_reward;
use crate::timer_job_types::{RemoveExpiredEventsJob, TimerJob};
use crate::updates::c2c_freeze_group::freeze_group_impl;
use activity_notification_state::ActivityNotificationState;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use chat_events::Reader;
use fire_and_forget_handler::FireAndForgetHandler;
use group_chat_core::{
    AddResult as AddMemberResult, GroupChatCore, GroupMemberInternal, GroupRoleInternal, InvitedUsersResult, UserInvitation,
};
use group_community_common::{PaymentReceipts, PaymentRecipient, PendingPayment, PendingPaymentReason, PendingPaymentsQueue};
use instruction_counts_log::{InstructionCountEntry, InstructionCountFunctionId, InstructionCountsLog};
use msgpack::serialize_then_unwrap;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::cell::RefCell;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, HashSet};
use std::ops::Deref;
use types::SNS_FEE_SHARE_PERCENT;
use types::{
    AccessGate, BuildVersion, CanisterId, ChatMetrics, CommunityId, Cryptocurrency, Cycles, Document, Empty, EventIndex,
    FrozenGroupInfo, GroupCanisterGroupChatSummary, GroupMembership, GroupPermissions, GroupSubtype, MessageIndex,
    Milliseconds, Notification, PaymentGate, Rules, TimestampMillis, Timestamped, UserId, MAX_THREADS_IN_SUMMARY,
};
use utils::consts::OPENCHAT_BOT_USER_ID;
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;
use utils::time::{DAY_IN_MS, HOUR_IN_MS};

mod activity_notifications;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod new_joiner_rewards;
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

    pub fn is_caller_escrow_canister(&self) -> bool {
        self.env.caller() == self.data.escrow_canister_id
    }

    pub fn is_caller_community_being_imported_into(&self) -> bool {
        if let Some(community_id) = self
            .data
            .community_being_imported_into
            .as_ref()
            .and_then(|c| c.community_id())
        {
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
            .chat
            .members
            .iter()
            .filter(|m| matches!(m.role.value, GroupRoleInternal::Owner))
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

    pub fn summary(&self, member: &GroupMemberInternal) -> GroupCanisterGroupChatSummary {
        let chat = &self.data.chat;
        let min_visible_event_index = member.min_visible_event_index();
        let min_visible_message_index = member.min_visible_message_index();
        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index);
        let events_ttl = chat.events.get_events_time_to_live();

        let membership = GroupMembership {
            joined: member.date_added,
            role: member.role.value.into(),
            mentions: member.most_recent_mentions(None, &chat.events),
            notifications_muted: member.notifications_muted.value,
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
                member.user_id,
            ),
            rules_accepted: member
                .rules_accepted
                .as_ref()
                .map_or(false, |version| version.value >= chat.rules.text.version),
        };

        GroupCanisterGroupChatSummary {
            chat_id: self.env.canister_id().into(),
            local_user_index_canister_id: self.data.local_user_index_canister_id,
            last_updated: chat.last_updated(Some(member.user_id)),
            name: chat.name.value.clone(),
            description: chat.description.value.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: Document::id(&chat.avatar),
            is_public: chat.is_public.value,
            history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
            min_visible_event_index,
            min_visible_message_index,
            latest_message: main_events_reader.latest_message_event(Some(member.user_id)),
            latest_event_index: main_events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: main_events_reader.latest_message_index(),
            joined: membership.joined,
            participant_count: chat.members.len(),
            role: membership.role,
            mentions: membership.mentions.clone(),
            permissions_v2: chat.permissions.value.clone(),
            notifications_muted: membership.notifications_muted,
            metrics: chat.events.metrics().hydrate(),
            my_metrics: membership.my_metrics.clone(),
            latest_threads: membership.latest_threads.clone(),
            frozen: self.data.frozen.value.clone(),
            wasm_version: BuildVersion::default(),
            date_last_pinned: chat.date_last_pinned,
            events_ttl: events_ttl.value,
            events_ttl_last_updated: events_ttl.timestamp,
            gate: chat.gate.value.clone(),
            rules_accepted: membership.rules_accepted,
            membership: Some(membership),
        }
    }

    pub fn add_member(&mut self, args: AddMemberArgs) -> AddMemberResult {
        let result = self.data.chat.members.add(
            args.user_id,
            args.now,
            args.min_visible_event_index,
            args.min_visible_message_index,
            args.mute_notifications,
            args.is_bot,
        );

        if matches!(result, AddMemberResult::Success(_) | AddMemberResult::AlreadyInGroup) {
            self.data.principal_to_user_id_map.insert(args.principal, args.user_id);
            if let Some(new_joiner_rewards) = &mut self.data.new_joiner_rewards {
                if let Ok(amount) = new_joiner_rewards.try_claim_user_reward(args.user_id, args.now) {
                    ic_cdk::spawn(process_new_joiner_reward(
                        self.env.canister_id(),
                        args.user_id,
                        Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
                        amount,
                        args.now,
                    ));
                }
            }
        }

        result
    }

    pub fn start_importing_into_community(&mut self, community: CommunityBeingImportedInto) -> StartImportIntoCommunityResult {
        use StartImportIntoCommunityResult::*;

        if self.data.community_being_imported_into.is_some() && self.data.is_frozen() {
            AlreadyImportingToAnotherCommunity
        } else if self.data.is_frozen() {
            ChatFrozen
        } else {
            let transfers_required = self.prepare_transfers_for_import_into_community();
            let serialized = serialize_then_unwrap(&self.data.chat);
            let total_bytes = serialized.len() as u64;

            if let Some(community_id) = community.community_id() {
                self.transfer_funds_to_community_being_imported_into(community_id, &transfers_required);
            }

            self.data.community_being_imported_into = Some(community);
            self.data.serialized_chat_state = Some(ByteBuf::from(serialized));

            freeze_group_impl(
                OPENCHAT_BOT_USER_ID,
                Some("Chat is being imported into a community".to_string()),
                false,
                self,
            );

            Success(StartImportIntoCommunityResultSuccess {
                total_bytes,
                transfers_required,
            })
        }
    }

    pub fn prepare_transfers_for_import_into_community(&mut self) -> HashMap<CanisterId, (u128, u128)> {
        let now = self.env.now();
        let max_prize_message_length = 7 * DAY_IN_MS;
        let pending_prize_messages = self
            .data
            .chat
            .events
            .pending_prize_messages(now.saturating_sub(max_prize_message_length));

        let mut transfers_required = HashMap::new();

        for (message_id, prize_message) in pending_prize_messages {
            let ledger = prize_message.transaction.ledger_canister_id();
            let fee = prize_message.transaction.fee();
            let amount: u128 = prize_message.prizes_remaining.iter().map(|p| p.e8s() as u128 + fee).sum();

            match transfers_required.entry(ledger) {
                Vacant(e) => {
                    e.insert((amount.saturating_sub(fee), fee));
                    self.data.chat.events.reduce_final_prize_by_transfer_fee(message_id);
                }
                Occupied(e) => {
                    let (total, _) = e.into_mut();
                    *total += amount;
                }
            }
        }

        transfers_required
    }

    fn transfer_funds_to_community_being_imported_into(
        &mut self,
        community_id: CommunityId,
        transfers: &HashMap<CanisterId, (u128, u128)>,
    ) {
        for (&ledger_canister, &(amount, fee)) in transfers.iter() {
            self.data.pending_payments_queue.push(PendingPayment {
                amount,
                fee,
                ledger_canister,
                recipient: PaymentRecipient::Account(Principal::from(community_id).into()),
                reason: PendingPaymentReason::TransferToCommunityBeingImportedInto,
            });
        }
        jobs::make_pending_payments::start_job_if_required(self);
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        self.data.chat.remove_expired_events(now);

        self.data.next_event_expiry = self.data.chat.events.next_event_expiry();
        if let Some(expiry) = self.data.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn metrics(&self) -> Metrics {
        let group_chat_core = &self.data.chat;
        let now = self.env.now();
        let messages_in_last_hour = group_chat_core
            .events
            .event_count_since(now.saturating_sub(HOUR_IN_MS), |e| e.is_message()) as u64;
        let messages_in_last_day = group_chat_core
            .events
            .event_count_since(now.saturating_sub(DAY_IN_MS), |e| e.is_message()) as u64;
        let events_in_last_hour = group_chat_core
            .events
            .event_count_since(now.saturating_sub(HOUR_IN_MS), |_| true) as u64;
        let events_in_last_day = group_chat_core
            .events
            .event_count_since(now.saturating_sub(DAY_IN_MS), |_| true) as u64;

        Metrics {
            memory_used: utils::memory::used(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public: group_chat_core.is_public.value,
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
            community_being_imported_into: self
                .data
                .community_being_imported_into
                .as_ref()
                .and_then(|c| c.community_id()),
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
                escrow_canister_id: self.data.escrow_canister_id,
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
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
    pub escrow_canister_id: CanisterId,
    pub invite_code: Option<u64>,
    pub invite_code_enabled: bool,
    pub new_joiner_rewards: Option<NewJoinerRewards>,
    pub frozen: Timestamped<Option<FrozenGroupInfo>>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub activity_notification_state: ActivityNotificationState,
    #[serde(skip, default = "init_instruction_counts_log")]
    pub instruction_counts_log: InstructionCountsLog,
    pub test_mode: bool,
    pub community_being_imported_into: Option<CommunityBeingImportedInto>,
    pub serialized_chat_state: Option<ByteBuf>,
    pub next_event_expiry: Option<TimestampMillis>,
    pub rng_seed: [u8; 32],
    pub pending_payments_queue: PendingPaymentsQueue,
    pub total_payment_receipts: PaymentReceipts,
}

fn init_instruction_counts_log() -> InstructionCountsLog {
    InstructionCountsLog::init(get_instruction_counts_index_memory(), get_instruction_counts_data_memory())
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        is_public: bool,
        name: String,
        description: String,
        rules: Rules,
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
        escrow_canister_id: CanisterId,
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
            proposals_bot_user_id == creator_user_id,
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
            escrow_canister_id,
            activity_notification_state: ActivityNotificationState::new(now, mark_active_duration),
            test_mode,
            invite_code: None,
            invite_code_enabled: false,
            new_joiner_rewards: None,
            frozen: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            instruction_counts_log: init_instruction_counts_log(),
            community_being_imported_into: None,
            serialized_chat_state: None,
            next_event_expiry: None,
            rng_seed: [0; 32],
            pending_payments_queue: PendingPaymentsQueue::default(),
            total_payment_receipts: PaymentReceipts::default(),
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
        self.chat.is_public.value
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
        let wasm_version = WASM_VERSION.with_borrow(|v| **v);
        let instructions_count = ic_cdk::api::instruction_counter();

        let _ = self
            .instruction_counts_log
            .record(function_id, instructions_count, wasm_version, now);
    }

    pub fn mark_group_updated_in_user_canister(&self, user_id: UserId) {
        self.fire_and_forget_handler.send(
            user_id.into(),
            "c2c_mark_group_updated_for_user_msgpack".to_string(),
            serialize_then_unwrap(Empty {}),
        );
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
    pub wasm_version: BuildVersion,
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
    is_bot: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityBeingImportedInto {
    New,
    Existing(CommunityId),
}

impl CommunityBeingImportedInto {
    fn community_id(&self) -> Option<CommunityId> {
        if let CommunityBeingImportedInto::Existing(community_id) = self {
            Some(*community_id)
        } else {
            None
        }
    }
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
    pub proposals_bot: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub icp_ledger: CanisterId,
}

pub enum StartImportIntoCommunityResult {
    Success(StartImportIntoCommunityResultSuccess),
    AlreadyImportingToAnotherCommunity,
    ChatFrozen,
}

pub struct StartImportIntoCommunityResultSuccess {
    pub total_bytes: u64,
    pub transfers_required: HashMap<CanisterId, (u128, u128)>,
}
