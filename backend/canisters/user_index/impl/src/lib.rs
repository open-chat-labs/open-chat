use crate::model::local_user_index_map::LocalUserIndex;
use crate::model::storage_index_user_sync_queue::OpenStorageUserSyncQueue;
use crate::model::user_map::UserMap;
use crate::model::user_principal_updates_queue::UserPrincipalUpdatesQueue;
use crate::model::user_referral_leaderboards::UserReferralLeaderboards;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use event_sink_client::{EventSinkClient, EventSinkClientBuilder, EventSinkClientInfo};
use event_sink_client_cdk_runtime::CdkRuntime;
use fire_and_forget_handler::FireAndForgetHandler;
use icrc_ledger_types::icrc1::account::{Account, Subaccount};
use local_user_index_canister::Event as LocalUserIndexEvent;
use model::local_user_index_map::LocalUserIndexMap;
use model::pending_modclub_submissions_queue::{PendingModclubSubmission, PendingModclubSubmissionsQueue};
use model::pending_payments_queue::{PendingPayment, PendingPaymentsQueue};
use model::reported_messages::{ReportedMessages, ReportingMetrics};
use nns_governance_canister::types::manage_neuron::claim_or_refresh::By;
use nns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command};
use nns_governance_canister::types::{Empty, ManageNeuron, NeuronId};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};
use std::time::Duration;
use types::{
    BuildVersion, CanisterId, CanisterWasm, ChatId, Cryptocurrency, Cycles, DiamondMembershipFees, Milliseconds,
    TimestampMillis, Timestamped, UserId,
};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::consts::DEV_TEAM_DFX_PRINCIPAL;
use utils::env::Environment;
use utils::time::DAY_IN_MS;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod timer_job_types;
mod updates;

pub const USER_LIMIT: usize = 150_000;

const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS: Milliseconds = DAY_IN_MS * 90; // 90 days
const ONE_MB: u64 = 1024 * 1024;
const ONE_GB: u64 = 1024 * ONE_MB;

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

    pub fn is_caller_identity_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.identity_canister_id
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

    pub fn is_caller_dev_team_dfx_principal(&self) -> bool {
        let caller = self.env.caller();
        caller == DEV_TEAM_DFX_PRINCIPAL
    }

    pub fn is_caller_modclub(&self) -> bool {
        let caller = self.env.caller();
        caller == self.modclub_canister_id()
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
            if except.map_or(true, |id| id != *canister_id) {
                self.data.user_index_event_sync_queue.push(*canister_id, event.clone());
            }
        }
        jobs::sync_events_to_local_user_index_canisters::try_run_now(self);
    }

    pub fn track_event<T: Serialize>(&mut self, name: &str, timestamp: TimestampMillis, user: Option<UserId>, payload: T) {
        let payload_json = serde_json::to_vec(&payload).unwrap();

        self.data.event_sink_client.push_event(event_sink_client::Event {
            name: name.to_string(),
            timestamp,
            user: user.map(|u| u.to_string()),
            source: Some(self.env.canister_id().to_text()),
            payload: payload_json,
        });
    }

    pub fn queue_payment(&mut self, pending_payment: PendingPayment) {
        self.data.pending_payments_queue.push(pending_payment);
        jobs::make_pending_payments::start_job_if_required(self);
    }

    pub fn queue_modclub_submission(&mut self, pending_submission: PendingModclubSubmission) {
        self.data.pending_modclub_submissions_queue.push(pending_submission);
        jobs::submit_message_to_modclub::start_job_if_required(self);
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        let event_sink_client_info = self.data.event_sink_client.info();
        let event_relay_canister_id = event_sink_client_info.event_sink_canister_id;

        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
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
            user_wasm_version: self.data.user_canister_wasm.version,
            local_user_index_wasm_version: self.data.local_user_index_canister_wasm_for_new_canisters.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            platform_moderators: self.data.platform_moderators.len() as u8,
            platform_operators: self.data.platform_operators.len() as u8,
            user_index_events_queue_length: self.data.user_index_event_sync_queue.len(),
            local_user_indexes: self.data.local_index_map.iter().map(|(c, i)| (*c, i.clone())).collect(),
            platform_moderators_group: self.data.platform_moderators_group,
            nns_8_year_neuron: self.data.nns_8_year_neuron.clone(),
            event_sink_client_info,
            pending_modclub_submissions: self.data.pending_modclub_submissions_queue.len(),
            pending_payments: self.data.pending_payments_queue.len(),
            pending_user_principal_updates: self.data.user_principal_updates_queue.len(),
            pending_legacy_principals_to_sync: self.data.legacy_principals_sync_queue.len(),
            pending_users_to_sync_to_storage_index: self.data.storage_index_user_sync_queue.len(),
            reporting_metrics: self.data.reported_messages.metrics(),
            canister_ids: CanisterIds {
                group_index: self.data.group_index_canister_id,
                notifications_index: self.data.notifications_index_canister_id,
                identity: self.data.identity_canister_id,
                proposals_bot: self.data.proposals_bot_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                storage_index: self.data.storage_index_canister_id,
                escrow: self.data.escrow_canister_id,
                translations: self.data.translations_canister_id,
                event_relay: event_relay_canister_id,
                internet_identity: self.data.internet_identity_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub users: UserMap,
    pub governance_principals: HashSet<Principal>,
    pub user_canister_wasm: CanisterWasm,
    pub local_user_index_canister_wasm_for_new_canisters: CanisterWasm,
    pub local_user_index_canister_wasm_for_upgrades: CanisterWasm,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_canister_id: CanisterId,
    pub storage_index_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub translations_canister_id: CanisterId,
    pub event_sink_client: EventSinkClient<CdkRuntime>,
    pub storage_index_user_sync_queue: OpenStorageUserSyncQueue,
    pub user_index_event_sync_queue: CanisterEventSyncQueue<LocalUserIndexEvent>,
    pub user_principal_updates_queue: UserPrincipalUpdatesQueue,
    pub legacy_principals_sync_queue: VecDeque<Principal>,
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
    pub user_referral_leaderboards: UserReferralLeaderboards,
    pub platform_moderators_group: Option<ChatId>,
    pub reported_messages: ReportedMessages,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub nns_8_year_neuron: Option<NnsNeuron>,
    pub rng_seed: [u8; 32],
    pub diamond_membership_fees: DiamondMembershipFees,
    pub legacy_principals_synced: bool,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        governance_principals: Vec<Principal>,
        user_canister_wasm: CanisterWasm,
        local_user_index_canister_wasm: CanisterWasm,
        group_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        storage_index_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        nns_governance_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        translations_canister_id: CanisterId,
        test_mode: bool,
    ) -> Self {
        let mut data = Data {
            users: UserMap::default(),
            governance_principals: governance_principals.into_iter().collect(),
            user_canister_wasm,
            local_user_index_canister_wasm_for_new_canisters: local_user_index_canister_wasm.clone(),
            local_user_index_canister_wasm_for_upgrades: local_user_index_canister_wasm,
            group_index_canister_id,
            notifications_index_canister_id,
            identity_canister_id,
            proposals_bot_canister_id,
            cycles_dispenser_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id,
            escrow_canister_id,
            translations_canister_id,
            event_sink_client: EventSinkClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            storage_index_user_sync_queue: OpenStorageUserSyncQueue::default(),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            user_principal_updates_queue: UserPrincipalUpdatesQueue::default(),
            legacy_principals_sync_queue: VecDeque::default(),
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
            user_referral_leaderboards: UserReferralLeaderboards::default(),
            platform_moderators_group: None,
            nns_8_year_neuron: None,
            reported_messages: ReportedMessages::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            legacy_principals_synced: false,
        };

        // Register the ProposalsBot
        data.users.register(
            proposals_bot_canister_id,
            proposals_bot_canister_id.into(),
            "ProposalsBot".to_string(),
            0,
            None,
            true,
        );

        data
    }

    pub fn nns_neuron_account(&self) -> Option<Account> {
        self.nns_8_year_neuron.as_ref().map(|n| Account {
            owner: self.nns_governance_canister_id,
            subaccount: Some(n.subaccount),
        })
    }

    pub fn refresh_nns_neuron(&self) {
        if let Some(neuron_id) = self.nns_8_year_neuron.as_ref().map(|n| n.neuron_id) {
            ic_cdk::spawn(refresh_nns_neuron_inner(self.nns_governance_canister_id, neuron_id));
        }

        async fn refresh_nns_neuron_inner(nns_governance_canister_id: CanisterId, neuron_id: u64) {
            let _ = nns_governance_canister_c2c_client::manage_neuron(
                nns_governance_canister_id,
                &ManageNeuron {
                    id: Some(NeuronId { id: neuron_id }),
                    neuron_id_or_subaccount: None,
                    command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
                        by: Some(By::NeuronIdOrSubaccount(Empty {})),
                    })),
                },
            )
            .await;
        }
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            users: UserMap::default(),
            governance_principals: HashSet::new(),
            user_canister_wasm: CanisterWasm::default(),
            local_user_index_canister_wasm_for_new_canisters: CanisterWasm::default(),
            local_user_index_canister_wasm_for_upgrades: CanisterWasm::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_index_canister_id: Principal::anonymous(),
            identity_canister_id: Principal::anonymous(),
            proposals_bot_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id: Principal::anonymous(),
            escrow_canister_id: Principal::anonymous(),
            translations_canister_id: Principal::anonymous(),
            event_sink_client: EventSinkClientBuilder::new(Principal::anonymous(), CdkRuntime::default()).build(),
            storage_index_user_sync_queue: OpenStorageUserSyncQueue::default(),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            user_principal_updates_queue: UserPrincipalUpdatesQueue::default(),
            legacy_principals_sync_queue: VecDeque::default(),
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
            user_referral_leaderboards: UserReferralLeaderboards::default(),
            platform_moderators_group: None,
            reported_messages: ReportedMessages::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            nns_8_year_neuron: None,
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            legacy_principals_synced: false,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
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
    pub event_sink_client_info: EventSinkClientInfo,
    pub pending_modclub_submissions: usize,
    pub pending_payments: usize,
    pub pending_user_principal_updates: usize,
    pub pending_legacy_principals_to_sync: usize,
    pub pending_users_to_sync_to_storage_index: usize,
    pub reporting_metrics: ReportingMetrics,
    pub canister_ids: CanisterIds,
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

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub identity: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub storage_index: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub internet_identity: CanisterId,
}
