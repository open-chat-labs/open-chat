use crate::model::cached_hot_groups::CachedHotGroups;
use crate::model::deleted_communities::DeletedCommunities;
use crate::model::deleted_groups::DeletedGroups;
use crate::model::local_group_index_map::LocalGroupIndex;
use crate::model::private_communities::PrivateCommunities;
use crate::model::private_groups::PrivateGroups;
use crate::model::public_communities::PublicCommunities;
use crate::model::public_group_and_community_names::PublicGroupAndCommunityNames;
use crate::model::public_groups::PublicGroups;
use candid::Principal;
use canister_state_macros::canister_state;
use fire_and_forget_handler::FireAndForgetHandler;
use group_index_canister::ChildCanisterType;
use model::local_group_index_map::LocalGroupIndexMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{
    AccessGate, BuildVersion, CanisterId, ChatId, ChildCanisterWasms, CommunityId, Cycles, FrozenGroupInfo, Milliseconds,
    TimestampMillis, Timestamped, UserId,
};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
use utils::time::MINUTE_IN_MS;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const FIVE_MINUTES_IN_MS: Milliseconds = MINUTE_IN_MS * 5;
const CACHED_HOT_GROUPS_COUNT: usize = 50;

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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_group_canister(&self) -> bool {
        let caller: ChatId = self.env.caller().into();
        self.data.public_groups.get(&caller).is_some() || self.data.private_groups.get(&caller).is_some()
    }

    pub fn is_caller_community_canister(&self) -> bool {
        let caller: CommunityId = self.env.caller().into();
        self.data.public_communities.get(&caller).is_some() || self.data.private_communities.get(&caller).is_some()
    }

    pub fn can_caller_upload_wasm_chunks(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller) || self.data.upload_wasm_chunks_whitelist.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            public_groups: self.data.public_groups.len() as u64,
            private_groups: self.data.private_groups.len() as u64,
            public_communities: self.data.public_communities.len() as u64,
            private_communities: self.data.private_communities.len() as u64,
            active_public_groups: self.data.cached_metrics.active_public_groups,
            active_private_groups: self.data.cached_metrics.active_private_groups,
            deleted_public_groups: self.data.cached_metrics.deleted_public_groups,
            deleted_private_groups: self.data.cached_metrics.deleted_private_groups,
            active_public_communities: self.data.cached_metrics.active_public_communities,
            active_private_communities: self.data.cached_metrics.active_private_communities,
            deleted_public_communities: self.data.cached_metrics.deleted_public_communities,
            deleted_private_communities: self.data.cached_metrics.deleted_private_communities,
            group_deleted_notifications_pending: self.data.deleted_groups.notifications_pending() as u64,
            community_deleted_notifications_pending: self.data.deleted_communities.notifications_pending() as u64,
            frozen_groups: self.data.cached_metrics.frozen_groups.clone(),
            frozen_communities: self.data.cached_metrics.frozen_communities.clone(),
            public_group_gates: self.data.cached_metrics.public_group_gates.clone(),
            public_community_gates: self.data.cached_metrics.public_community_gates.clone(),
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            local_group_index_wasm_version: self
                .data
                .child_canister_wasms
                .get(ChildCanisterType::LocalGroupIndex)
                .wasm
                .version,
            group_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Group).wasm.version,
            community_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Community).wasm.version,
            local_group_indexes: self.data.local_index_map.iter().map(|(c, i)| (*c, i.clone())).collect(),
            upload_wasm_chunks_whitelist: self.data.upload_wasm_chunks_whitelist.iter().copied().collect(),
            wasm_chunks_uploaded: self
                .data
                .child_canister_wasms
                .chunk_hashes()
                .into_iter()
                .map(|(c, h)| (*c, hex::encode(h)))
                .collect(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                escrow: self.data.escrow_canister_id,
                event_relay: self.data.event_relay_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub deleted_groups: DeletedGroups,
    pub public_communities: PublicCommunities,
    pub private_communities: PrivateCommunities,
    pub deleted_communities: DeletedCommunities,
    pub public_group_and_community_names: PublicGroupAndCommunityNames,
    pub governance_principals: HashSet<Principal>,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub escrow_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub test_mode: bool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cached_hot_groups: CachedHotGroups,
    pub cached_metrics: CachedMetrics,
    pub local_index_map: LocalGroupIndexMap,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub video_call_operators: Vec<Principal>,
    pub upload_wasm_chunks_whitelist: HashSet<Principal>,
    pub ic_root_key: Vec<u8>,
    pub rng_seed: [u8; 32],
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        governance_principals: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        ic_root_key: Vec<u8>,
        test_mode: bool,
    ) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            deleted_groups: DeletedGroups::default(),
            public_communities: PublicCommunities::default(),
            private_communities: PrivateCommunities::default(),
            deleted_communities: DeletedCommunities::default(),
            public_group_and_community_names: PublicGroupAndCommunityNames::default(),
            governance_principals: governance_principals.iter().copied().collect(),
            child_canister_wasms: ChildCanisterWasms::default(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            proposals_bot_user_id,
            escrow_canister_id,
            event_relay_canister_id,
            internet_identity_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            local_index_map: LocalGroupIndexMap::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            video_call_operators,
            upload_wasm_chunks_whitelist: HashSet::default(),
            ic_root_key,
            rng_seed: [0; 32],
        }
    }

    pub fn group_frozen_info(&self, chat_id: &ChatId) -> Option<Option<&FrozenGroupInfo>> {
        self.public_groups
            .get(chat_id)
            .map(|g| g.frozen_info())
            .or_else(|| self.private_groups.get(chat_id).map(|g| g.frozen_info()))
    }

    pub fn community_frozen_info(&self, community_id: &CommunityId) -> Option<Option<&FrozenGroupInfo>> {
        self.public_communities
            .get(community_id)
            .map(|c| c.frozen_info())
            .or_else(|| self.private_communities.get(community_id).map(|c| c.frozen_info()))
    }

    pub fn calculate_metrics(&mut self, now: TimestampMillis) {
        let deleted_group_metrics = self.deleted_groups.metrics();
        let deleted_community_metrics = self.deleted_communities.metrics();

        let mut cached_metrics = CachedMetrics {
            last_run: now,
            deleted_public_groups: deleted_group_metrics.public,
            deleted_private_groups: deleted_group_metrics.private,
            deleted_public_communities: deleted_community_metrics.public,
            deleted_private_communities: deleted_community_metrics.private,
            ..Default::default()
        };

        for public_group in self.public_groups.iter() {
            if public_group.has_been_active_since(now) {
                cached_metrics.active_public_groups += 1;
            }
            if public_group.is_frozen() {
                cached_metrics.frozen_groups.push(public_group.id());
            }
            if let Some(gate) = public_group.gate() {
                cached_metrics.public_group_gates.add(gate);
            }
        }

        for private_group in self.private_groups.iter() {
            if private_group.has_been_active_since(now) {
                cached_metrics.active_private_groups += 1;
            }
            if private_group.is_frozen() {
                cached_metrics.frozen_groups.push(private_group.id());
            }
        }

        for public_community in self.public_communities.iter() {
            if public_community.has_been_active_since(now) {
                cached_metrics.active_public_communities += 1;
            }
            if public_community.is_frozen() {
                cached_metrics.frozen_communities.push(public_community.id());
            }
            if let Some(gate) = public_community.gate() {
                cached_metrics.public_community_gates.add(gate);
            }
        }

        for private_community in self.private_communities.iter() {
            if private_community.has_been_active_since(now) {
                cached_metrics.active_private_groups += 1;
            }
            if private_community.is_frozen() {
                cached_metrics.frozen_communities.push(private_community.id());
            }
        }

        self.cached_metrics = cached_metrics;
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            deleted_groups: DeletedGroups::default(),
            public_communities: PublicCommunities::default(),
            private_communities: PrivateCommunities::default(),
            deleted_communities: DeletedCommunities::default(),
            public_group_and_community_names: PublicGroupAndCommunityNames::default(),
            governance_principals: HashSet::default(),
            child_canister_wasms: ChildCanisterWasms::default(),
            user_index_canister_id: Principal::anonymous(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            proposals_bot_user_id: Principal::anonymous().into(),
            escrow_canister_id: Principal::anonymous(),
            event_relay_canister_id: Principal::anonymous(),
            internet_identity_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode: true,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            local_index_map: LocalGroupIndexMap::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            video_call_operators: Vec::default(),
            upload_wasm_chunks_whitelist: HashSet::default(),
            ic_root_key: Vec::new(),
            rng_seed: [0; 32],
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub total_cycles_spent_on_canisters: Cycles,
    pub public_groups: u64,
    pub private_groups: u64,
    pub public_communities: u64,
    pub private_communities: u64,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub active_public_communities: u64,
    pub active_private_communities: u64,
    pub deleted_public_communities: u64,
    pub deleted_private_communities: u64,
    pub group_deleted_notifications_pending: u64,
    pub community_deleted_notifications_pending: u64,
    pub frozen_groups: Vec<ChatId>,
    pub frozen_communities: Vec<CommunityId>,
    pub public_group_gates: AccessGateMetrics,
    pub public_community_gates: AccessGateMetrics,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub local_group_index_wasm_version: BuildVersion,
    pub group_wasm_version: BuildVersion,
    pub community_wasm_version: BuildVersion,
    pub local_group_indexes: Vec<(CanisterId, LocalGroupIndex)>,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub wasm_chunks_uploaded: Vec<(ChildCanisterType, String)>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct CachedMetrics {
    pub last_run: TimestampMillis,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub active_public_communities: u64,
    pub active_private_communities: u64,
    pub deleted_public_communities: u64,
    pub deleted_private_communities: u64,
    pub frozen_groups: Vec<ChatId>,
    pub frozen_communities: Vec<CommunityId>,
    pub public_group_gates: AccessGateMetrics,
    pub public_community_gates: AccessGateMetrics,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub escrow: CanisterId,
    pub event_relay: CanisterId,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AccessGateMetrics {
    pub diamond_membership: u32,
    #[serde(default)]
    pub lifetime_diamond_membership: u32,
    #[serde(default)]
    pub unique_person: u32,
    pub verified_credential: u32,
    pub sns_neuron: u32,
    pub payment: u32,
    pub token_balance: u32,
    #[serde(default)]
    pub composite: u32,
    #[serde(default)]
    pub locked: u32,
    #[serde(default)]
    pub referred_by_member: u32,
}

impl AccessGateMetrics {
    pub fn add(&mut self, gate: &AccessGate) {
        match gate {
            AccessGate::DiamondMember => self.diamond_membership += 1,
            AccessGate::LifetimeDiamondMember => self.lifetime_diamond_membership += 1,
            AccessGate::UniquePerson => self.unique_person += 1,
            AccessGate::VerifiedCredential(_) => self.verified_credential += 1,
            AccessGate::SnsNeuron(_) => self.sns_neuron += 1,
            AccessGate::Payment(_) => self.payment += 1,
            AccessGate::TokenBalance(_) => self.token_balance += 1,
            AccessGate::Composite(_) => self.composite += 1,
            AccessGate::Locked => self.locked += 1,
            AccessGate::ReferredByMember => self.referred_by_member += 1,
        }
    }
}
