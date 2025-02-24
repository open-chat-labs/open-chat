use crate::model::local_user_index_map::LocalUserIndex;
use crate::model::notifications_index_event_batch::NotificationsIndexEventBatch;
use crate::model::storage_index_user_config_batch::StorageIndexUserConfigBatch;
use crate::model::storage_index_users_to_remove_batch::StorageIndexUsersToRemoveBatch;
use crate::model::streak_insurance_logs::StreakInsuranceLogs;
use crate::model::user_map::UserMap;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use constants::DAY_IN_MS;
use event_store_producer::{EventBuilder, EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use fire_and_forget_handler::FireAndForgetHandler;
use icrc_ledger_types::icrc1::account::{Account, Subaccount};
use local_user_index_canister::UserIndexEvent as LocalUserIndexEvent;
use model::chit_leaderboard::ChitLeaderboard;
use model::external_achievements::{ExternalAchievementMetrics, ExternalAchievements};
use model::local_user_index_map::LocalUserIndexMap;
use model::pending_modclub_submissions_queue::{PendingModclubSubmission, PendingModclubSubmissionsQueue};
use model::pending_payments_queue::{PendingPayment, PendingPaymentsQueue};
use model::reported_messages::{ReportedMessages, ReportingMetrics};
use model::user::SuspensionDetails;
use p256_key_pair::P256KeyPair;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::time::Duration;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, ChatId, ChildCanisterWasms, Cryptocurrency, Cycles, DiamondMembershipFees, IdempotentMessage,
    Milliseconds, TimestampMillis, Timestamped, UserId, UserType,
};
use user_index_canister::ChildCanisterType;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::env::Environment;
use utils::idempotency_checker::IdempotencyChecker;
use utils::time::MonthKey;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod timer_job_types;
mod updates;

const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS: Milliseconds = DAY_IN_MS * 90; // 90 days

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_openchat_user(&self) -> bool {
        let caller = self.env.caller();
        self.data.users.get(&caller).is_some()
    }

    pub fn is_caller_user_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.users.get_by_user_id(&caller.into()).is_some()
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn is_caller_local_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_index_map.get(&caller).is_some()
    }

    pub fn is_caller_group_index_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.group_index_canister_id
    }

    pub fn is_caller_translations_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.translations_canister_id
    }

    pub fn is_caller_platform_moderator(&self) -> bool {
        let caller = self.env.caller();
        if let Some(user) = self.data.users.get_by_principal(&caller) {
            self.data.platform_moderators.contains(&user.user_id)
        } else {
            false
        }
    }

    pub fn is_caller_platform_operator(&self) -> bool {
        let caller = self.env.caller();
        if let Some(user) = self.data.users.get_by_principal(&caller) {
            self.data.platform_operators.contains(&user.user_id)
        } else {
            false
        }
    }

    pub fn is_caller_modclub(&self) -> bool {
        let caller = self.env.caller();
        caller == self.modclub_canister_id()
    }

    pub fn can_caller_upload_wasm_chunks(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller) || self.data.upload_wasm_chunks_whitelist.contains(&caller)
    }

    pub fn modclub_canister_id(&self) -> CanisterId {
        let modclub_canister_id =
            if self.data.test_mode { "d7isk-4aaaa-aaaah-qdbsa-cai" } else { "gwuzc-waaaa-aaaah-qdboa-cai" };

        Principal::from_text(modclub_canister_id).unwrap()
    }

    pub fn push_event_to_local_user_index(&mut self, user_id: UserId, event: LocalUserIndexEvent) {
        if let Some(canister_id) = self.data.local_index_map.get_index_canister(&user_id) {
            self.data.user_index_event_sync_queue.push(canister_id, event);
            jobs::sync_events_to_local_user_index_canisters::try_run_now(self);
        }
    }

    pub fn push_event_to_all_local_user_indexes(&mut self, event: LocalUserIndexEvent, except: Option<CanisterId>) {
        for canister_id in self.data.local_index_map.canisters() {
            if except != Some(*canister_id) {
                self.data.user_index_event_sync_queue.push(*canister_id, event.clone());
            }
        }
        jobs::sync_events_to_local_user_index_canisters::try_run_now(self);
    }

    pub fn push_event_to_notifications_index(
        &mut self,
        event: notifications_index_canister::UserIndexEvent,
        now: TimestampMillis,
    ) {
        self.data.notifications_index_event_sync_queue.push(
            self.data.notifications_index_canister_id,
            IdempotentMessage {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        )
    }

    pub fn queue_payment(&mut self, pending_payment: PendingPayment) {
        self.data.pending_payments_queue.push(pending_payment);
        jobs::make_pending_payments::start_job_if_required(self);
    }

    pub fn queue_modclub_submission(&mut self, pending_submission: PendingModclubSubmission) {
        self.data.pending_modclub_submissions_queue.push(pending_submission);
        jobs::submit_message_to_modclub::start_job_if_required(self);
    }

    pub fn delete_user(&mut self, user_id: UserId, triggered_by_user: bool) {
        let now = self.env.now();
        if let Some(user) = self.data.users.delete_user(user_id, now) {
            self.data.local_index_map.remove_user(&user_id);
            self.data.empty_users.remove(&user_id);

            #[derive(Serialize)]
            struct EventPayload {
                triggered_by_user: bool,
            }

            self.data.event_store_client.push(
                EventBuilder::new("user_deleted", now)
                    .with_user(user_id.to_string(), true)
                    .with_source(self.env.canister_id().to_string(), false)
                    .with_json_payload(&EventPayload { triggered_by_user })
                    .build(),
            );

            self.data.deleted_users.push(DeletedUser {
                user_id,
                triggered_by_user,
                timestamp: now,
            });

            self.data.identity_canister_user_sync_queue.push_back((user.principal, None));
            jobs::sync_users_to_identity_canister::try_run_now(self);

            self.data.remove_from_online_users_queue.push_back(user.principal);
            jobs::remove_from_online_users_canister::start_job_if_required(self);

            self.data
                .storage_index_users_to_remove_queue
                .push(self.data.storage_index_canister_id, user.principal);
        }
    }

    pub fn user_metrics(&self, user_id: UserId) -> Option<UserMetrics> {
        self.data.users.get_by_user_id(&user_id).map(|user| {
            let now = self.env.now();
            UserMetrics {
                now,
                username: user.username.clone(),
                date_created: user.date_created,
                date_updated: user.date_updated,
                is_bot: user.user_type.is_bot(),
                suspension_details: user.suspension_details.clone(),
                moderation_flags_enabled: user.moderation_flags_enabled,
                chit_balance: user
                    .chit_per_month
                    .get(&MonthKey::from_timestamp(now))
                    .copied()
                    .unwrap_or_default(),
                streak: user.streak(now),
                streak_ends: user.streak_ends,
                chit_updated: user.chit_updated,
            }
        })
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();

        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            users_created: self.data.users.len() as u64,
            diamond_members: DiamondMembershipMetrics {
                users: self.data.users.diamond_metrics(now),
                payments: self.data.diamond_membership_payment_metrics.clone(),
            },
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            user_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::User).wasm.version,
            local_user_index_wasm_version: self
                .data
                .child_canister_wasms
                .get(ChildCanisterType::LocalUserIndex)
                .wasm
                .version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            platform_moderators: self.data.platform_moderators.len() as u8,
            platform_operators: self.data.platform_operators.len() as u8,
            user_index_events_queue_length: self.data.user_index_event_sync_queue.len(),
            local_user_indexes: self.data.local_index_map.iter().map(|(c, i)| (*c, i.clone())).collect(),
            platform_moderators_group: self.data.platform_moderators_group,
            nns_8_year_neuron: self.data.nns_8_year_neuron.clone(),
            event_store_client_info,
            pending_modclub_submissions: self.data.pending_modclub_submissions_queue.len(),
            pending_payments: self.data.pending_payments_queue.len(),
            pending_users_to_sync_to_storage_index: self.data.storage_index_user_sync_queue.len(),
            reporting_metrics: self.data.reported_messages.metrics(),
            oc_public_key: self.data.oc_key_pair.public_key_pem().to_string(),
            empty_users: self.data.empty_users.len(),
            deleted_users: self.data.deleted_users.len(),
            unique_person_proofs_submitted: self.data.users.unique_person_proofs_submitted(),
            july_airdrop_period: self.build_stats_for_cohort(1719792000000, 1723021200000),
            august_airdrop_period: self.build_stats_for_cohort(1723021200000, 1725181200000),
            streak_badges: self.data.users.streak_badge_metrics(now),
            survey_messages_sent: self.data.survey_messages_sent,
            external_achievements: self.data.external_achievements.metrics(),
            upload_wasm_chunks_whitelist: self.data.upload_wasm_chunks_whitelist.clone(),
            wasm_chunks_uploaded: self
                .data
                .child_canister_wasms
                .chunk_hashes()
                .into_iter()
                .map(|(c, h)| (*c, hex::encode(h)))
                .collect(),
            stable_memory_sizes: memory::memory_sizes(),
            streak_insurance_metrics: self.data.streak_insurance_logs.metrics(),
            canister_ids: CanisterIds {
                group_index: self.data.group_index_canister_id,
                notifications_index: self.data.notifications_index_canister_id,
                identity: self.data.identity_canister_id,
                proposals_bot: self.data.proposals_bot_canister_id,
                airdrop_bot: self.data.airdrop_bot_canister_id,
                online_users: self.data.online_users_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                storage_index: self.data.storage_index_canister_id,
                escrow: self.data.escrow_canister_id,
                translations: self.data.translations_canister_id,
                event_relay: event_relay_canister_id,
                registry: self.data.registry_canister_id,
                internet_identity: self.data.internet_identity_canister_id,
                website: self.data.website_canister_id,
            },
        }
    }

    fn build_stats_for_cohort(&self, airdrop_from: TimestampMillis, airdrop_to: TimestampMillis) -> AirdropStats {
        let mut stats = AirdropStats::default();

        for user in self.data.users.iter() {
            let diamond = user.diamond_membership_details.was_active(airdrop_from)
                || user.diamond_membership_details.was_active(airdrop_to);

            let lifetime_diamond = user.diamond_membership_details.is_lifetime_diamond_member();

            if diamond {
                stats.diamond += 1;
            }

            if lifetime_diamond {
                stats.lifetime_diamond += 1;
            }

            if user.unique_person_proof.is_some() {
                stats.proved_uniqueness += 1;
            }

            if (user.unique_person_proof.is_some() && diamond) || lifetime_diamond {
                stats.qualify_for_airdrop += 1;
            }
        }

        stats
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub users: UserMap,
    pub governance_principals: HashSet<Principal>,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub airdrop_bot_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_canister_id: CanisterId,
    pub storage_index_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub translations_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub storage_index_user_sync_queue: GroupedTimerJobQueue<StorageIndexUserConfigBatch>,
    pub storage_index_users_to_remove_queue: GroupedTimerJobQueue<StorageIndexUsersToRemoveBatch>,
    pub user_index_event_sync_queue: CanisterEventSyncQueue<LocalUserIndexEvent>,
    pub notifications_index_event_sync_queue: GroupedTimerJobQueue<NotificationsIndexEventBatch>,
    pub pending_payments_queue: PendingPaymentsQueue,
    pub pending_modclub_submissions_queue: PendingModclubSubmissionsQueue,
    pub platform_moderators: HashSet<UserId>,
    pub platform_operators: HashSet<UserId>,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: usize,
    pub diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics,
    pub local_index_map: LocalUserIndexMap,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub neuron_controllers_for_initial_airdrop: HashMap<UserId, Principal>,
    pub nns_governance_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub platform_moderators_group: Option<ChatId>,
    pub reported_messages: ReportedMessages,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub nns_8_year_neuron: Option<NnsNeuron>,
    pub rng_seed: [u8; 32],
    pub diamond_membership_fees: DiamondMembershipFees,
    pub video_call_operators: Vec<Principal>,
    pub oc_key_pair: P256KeyPair,
    pub empty_users: HashSet<UserId>,
    pub chit_leaderboard: ChitLeaderboard,
    pub deleted_users: Vec<DeletedUser>,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub identity_canister_user_sync_queue: VecDeque<(Principal, Option<UserId>)>,
    pub remove_from_online_users_queue: VecDeque<Principal>,
    pub survey_messages_sent: usize,
    pub external_achievements: ExternalAchievements,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub streak_insurance_logs: StreakInsuranceLogs,
    #[serde(default)]
    pub idempotency_checker: IdempotencyChecker,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        governance_principals: Vec<Principal>,
        group_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        airdrop_bot_canister_id: CanisterId,
        online_users_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        storage_index_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        registry_canister_id: CanisterId,
        nns_governance_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        translations_canister_id: CanisterId,
        website_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        ic_root_key: Vec<u8>,
        test_mode: bool,
        now: TimestampMillis,
    ) -> Self {
        let mut data = Data {
            users: UserMap::default(),
            governance_principals: governance_principals.into_iter().collect(),
            child_canister_wasms: ChildCanisterWasms::default(),
            group_index_canister_id,
            notifications_index_canister_id,
            identity_canister_id,
            proposals_bot_canister_id,
            airdrop_bot_canister_id,
            online_users_canister_id,
            cycles_dispenser_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id,
            escrow_canister_id,
            translations_canister_id,
            registry_canister_id,
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            storage_index_user_sync_queue: GroupedTimerJobQueue::new(1, false),
            storage_index_users_to_remove_queue: GroupedTimerJobQueue::new(1, false),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            notifications_index_event_sync_queue: GroupedTimerJobQueue::new(1, false),
            pending_payments_queue: PendingPaymentsQueue::default(),
            pending_modclub_submissions_queue: PendingModclubSubmissionsQueue::default(),
            platform_moderators: HashSet::new(),
            platform_operators: HashSet::new(),
            test_mode,
            max_concurrent_canister_upgrades: 2,
            diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics::default(),
            local_index_map: LocalUserIndexMap::default(),
            timer_jobs: TimerJobs::default(),
            neuron_controllers_for_initial_airdrop: HashMap::new(),
            nns_governance_canister_id,
            internet_identity_canister_id,
            website_canister_id,
            platform_moderators_group: None,
            nns_8_year_neuron: None,
            reported_messages: ReportedMessages::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            video_call_operators,
            oc_key_pair: P256KeyPair::default(),
            empty_users: HashSet::new(),
            chit_leaderboard: ChitLeaderboard::new(now),
            deleted_users: Vec::new(),
            ic_root_key,
            identity_canister_user_sync_queue: VecDeque::new(),
            remove_from_online_users_queue: VecDeque::new(),
            survey_messages_sent: 0,
            external_achievements: ExternalAchievements::default(),
            upload_wasm_chunks_whitelist: Vec::new(),
            streak_insurance_logs: StreakInsuranceLogs::default(),
            idempotency_checker: IdempotencyChecker::default(),
        };

        // Register the ProposalsBot
        data.users.register(
            proposals_bot_canister_id,
            proposals_bot_canister_id.into(),
            "ProposalsBot".to_string(),
            None,
            now,
            None,
            UserType::OcControlledBot,
            None,
        );

        // Register the AirdropBot
        data.users.register(
            airdrop_bot_canister_id,
            airdrop_bot_canister_id.into(),
            "AirdropBot".to_string(),
            None,
            now,
            None,
            UserType::OcControlledBot,
            None,
        );

        data
    }

    pub fn nns_neuron_account(&self) -> Option<Account> {
        self.nns_8_year_neuron.as_ref().map(|n| Account {
            owner: self.nns_governance_canister_id,
            subaccount: Some(n.subaccount),
        })
    }

    pub fn chit_bands(&self, size: u32, year: u32, month: u8) -> BTreeMap<u32, u32> {
        let mut bands = BTreeMap::new();
        let month_key = MonthKey::new(year, month);

        for chit in self
            .users
            .iter()
            .map(|u| u.chit_per_month.get(&month_key).copied().unwrap_or_default())
            .filter(|c| *c > 0)
            .map(|c| c as u32)
        {
            let band = (chit / size) * size;
            let key = if band > 0 { (chit / band) * band } else { 0 };

            bands.entry(key).and_modify(|e| *e += 1).or_insert(1);
        }

        bands
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            users: UserMap::default(),
            governance_principals: HashSet::new(),
            child_canister_wasms: ChildCanisterWasms::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_index_canister_id: Principal::anonymous(),
            identity_canister_id: Principal::anonymous(),
            proposals_bot_canister_id: Principal::anonymous(),
            airdrop_bot_canister_id: Principal::anonymous(),
            online_users_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id: Principal::anonymous(),
            escrow_canister_id: Principal::anonymous(),
            translations_canister_id: Principal::anonymous(),
            registry_canister_id: Principal::anonymous(),
            event_store_client: EventStoreClientBuilder::new(Principal::anonymous(), CdkRuntime::default()).build(),
            storage_index_user_sync_queue: GroupedTimerJobQueue::new(1, false),
            storage_index_users_to_remove_queue: GroupedTimerJobQueue::new(1, false),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            notifications_index_event_sync_queue: GroupedTimerJobQueue::new(1, false),
            pending_payments_queue: PendingPaymentsQueue::default(),
            pending_modclub_submissions_queue: PendingModclubSubmissionsQueue::default(),
            platform_moderators: HashSet::new(),
            platform_operators: HashSet::new(),
            test_mode: true,
            max_concurrent_canister_upgrades: 2,
            diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics::default(),
            local_index_map: LocalUserIndexMap::default(),
            timer_jobs: TimerJobs::default(),
            neuron_controllers_for_initial_airdrop: HashMap::new(),
            nns_governance_canister_id: Principal::anonymous(),
            internet_identity_canister_id: Principal::anonymous(),
            website_canister_id: Principal::anonymous(),
            platform_moderators_group: None,
            reported_messages: ReportedMessages::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            nns_8_year_neuron: None,
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            video_call_operators: Vec::default(),
            oc_key_pair: P256KeyPair::default(),
            empty_users: HashSet::new(),
            chit_leaderboard: ChitLeaderboard::new(0),
            deleted_users: Vec::new(),
            ic_root_key: Vec::new(),
            identity_canister_user_sync_queue: VecDeque::new(),
            remove_from_online_users_queue: VecDeque::new(),
            survey_messages_sent: 0,
            external_achievements: ExternalAchievements::default(),
            upload_wasm_chunks_whitelist: Vec::new(),
            streak_insurance_logs: StreakInsuranceLogs::default(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub users_created: u64,
    pub diamond_members: DiamondMembershipMetrics,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub governance_principals: Vec<Principal>,
    pub user_wasm_version: BuildVersion,
    pub local_user_index_wasm_version: BuildVersion,
    pub max_concurrent_canister_upgrades: usize,
    pub platform_moderators: u8,
    pub platform_operators: u8,
    pub user_index_events_queue_length: usize,
    pub local_user_indexes: Vec<(CanisterId, LocalUserIndex)>,
    pub platform_moderators_group: Option<ChatId>,
    pub nns_8_year_neuron: Option<NnsNeuron>,
    pub event_store_client_info: EventStoreClientInfo,
    pub pending_modclub_submissions: usize,
    pub pending_payments: usize,
    pub pending_users_to_sync_to_storage_index: usize,
    pub reporting_metrics: ReportingMetrics,
    pub oc_public_key: String,
    pub empty_users: usize,
    pub deleted_users: usize,
    pub unique_person_proofs_submitted: u32,
    pub july_airdrop_period: AirdropStats,
    pub august_airdrop_period: AirdropStats,
    pub streak_badges: BTreeMap<u16, u32>,
    pub survey_messages_sent: usize,
    pub external_achievements: Vec<ExternalAchievementMetrics>,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub wasm_chunks_uploaded: Vec<(ChildCanisterType, String)>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub streak_insurance_metrics: StreakInsuranceMetrics,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct UserMetrics {
    pub now: TimestampMillis,
    pub username: String,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub is_bot: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub moderation_flags_enabled: u32,
    pub chit_balance: i32,
    pub chit_updated: TimestampMillis,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[derive(Serialize, Debug, Default)]
pub struct AirdropStats {
    pub diamond: u32,
    pub lifetime_diamond: u32,
    pub proved_uniqueness: u32,
    pub qualify_for_airdrop: u32,
}

#[derive(Serialize, Debug, Default)]
pub struct DiamondMembershipMetrics {
    pub users: DiamondMembershipUserMetrics,
    pub payments: DiamondMembershipPaymentMetrics,
}

#[derive(Serialize, Debug, Default)]
pub struct DiamondMembershipUserMetrics {
    pub total: u64,
    pub lifetime: u64,
    pub recurring: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DiamondMembershipPaymentMetrics {
    pub amount_raised: Vec<(Cryptocurrency, u128)>,
    pub manual_payments_taken: u64,
    pub recurring_payments_taken: u64,
    pub recurring_payments_failed_due_to_insufficient_funds: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NnsNeuron {
    pub neuron_id: u64,
    pub subaccount: Subaccount,
}

#[derive(Serialize)]
struct UserRegisteredEventPayload {
    referred: bool,
    is_bot: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeletedUser {
    pub user_id: UserId,
    pub triggered_by_user: bool,
    pub timestamp: TimestampMillis,
}

#[derive(Serialize, Debug, Default)]
pub struct StreakInsuranceMetrics {
    payments: u32,
    payments_unique_users: u32,
    claims: u32,
    claims_unique_users: u32,
    total_paid: u128,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub identity: CanisterId,
    pub proposals_bot: CanisterId,
    pub airdrop_bot: CanisterId,
    pub online_users: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub storage_index: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub registry: CanisterId,
    pub internet_identity: CanisterId,
    pub website: CanisterId,
}
