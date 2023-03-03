use crate::model::cached_hot_groups::CachedHotGroups;
use crate::model::deleted_groups::DeletedGroups;
use crate::model::local_group_index_map::LocalGroupIndex;
use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use model::local_group_index_map::LocalGroupIndexMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{
    CanisterId, CanisterWasm, ChatId, Cycles, FrozenGroupInfo, Milliseconds, TimestampMillis, Timestamped, UserDetails, UserId,
    Version,
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
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
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

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();

        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            public_groups: self.data.public_groups.len() as u32,
            private_groups: self.data.private_groups.len() as u64,
            active_public_groups: self.data.cached_metrics.active_public_groups,
            active_private_groups: self.data.cached_metrics.active_private_groups,
            deleted_public_groups: self.data.cached_metrics.deleted_public_groups,
            deleted_private_groups: self.data.cached_metrics.deleted_private_groups,
            group_deleted_notifications_pending: self.data.cached_metrics.group_deleted_notifications_pending,
            frozen_groups: self.data.cached_metrics.frozen_groups.clone(),
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            group_wasm_version: self.data.group_canister_wasm.version,
            local_group_index_wasm_version: self.data.local_group_index_canister_wasm_for_new_canisters.version,
            local_group_indexes: self.data.local_index_map.iter().map(|(c, i)| (*c, i.clone())).collect(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub deleted_groups: DeletedGroups,
    pub governance_principals: HashSet<Principal>,
    pub group_canister_wasm: CanisterWasm,
    pub local_group_index_canister_wasm_for_new_canisters: CanisterWasm,
    pub local_group_index_canister_wasm_for_upgrades: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub test_mode: bool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cached_hot_groups: CachedHotGroups,
    pub cached_metrics: CachedMetrics,
    pub local_index_map: LocalGroupIndexMap,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        governance_principals: Vec<Principal>,
        group_canister_wasm: CanisterWasm,
        local_group_index_canister_wasm: CanisterWasm,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        test_mode: bool,
    ) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            deleted_groups: DeletedGroups::default(),
            governance_principals: governance_principals.into_iter().collect(),
            group_canister_wasm,
            local_group_index_canister_wasm_for_new_canisters: local_group_index_canister_wasm.clone(),
            local_group_index_canister_wasm_for_upgrades: local_group_index_canister_wasm,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            proposals_bot_user_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            local_index_map: LocalGroupIndexMap::default(),
        }
    }

    pub fn chat_frozen_info(&self, chat_id: &ChatId) -> Option<Option<&FrozenGroupInfo>> {
        self.public_groups
            .get(chat_id)
            .map(|g| g.frozen_info())
            .or_else(|| self.private_groups.get(chat_id).map(|g| g.frozen_info()))
    }

    pub fn calculate_metrics(&mut self, now: TimestampMillis) {
        // Throttle to once every 5 minutes
        if now < self.cached_metrics.last_run + FIVE_MINUTES_IN_MS {
            return;
        }

        let deleted_group_metrics = self.deleted_groups.metrics();

        let mut cached_metrics = CachedMetrics {
            last_run: now,
            deleted_public_groups: deleted_group_metrics.public,
            deleted_private_groups: deleted_group_metrics.private,
            group_deleted_notifications_pending: deleted_group_metrics.notifications_pending,
            ..Default::default()
        };

        for public_group in self.public_groups.iter() {
            if public_group.has_been_active_since(now) {
                cached_metrics.active_public_groups += 1;
            }
            if public_group.is_frozen() {
                cached_metrics.frozen_groups.push(public_group.id());
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
            governance_principals: HashSet::default(),
            group_canister_wasm: CanisterWasm::default(),
            local_group_index_canister_wasm_for_new_canisters: CanisterWasm::default(),
            local_group_index_canister_wasm_for_upgrades: CanisterWasm::default(),
            user_index_canister_id: Principal::anonymous(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            proposals_bot_user_id: Principal::anonymous().into(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode: true,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            local_index_map: LocalGroupIndexMap::default(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub total_cycles_spent_on_canisters: Cycles,
    pub public_groups: u32,
    pub private_groups: u64,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub group_deleted_notifications_pending: u64,
    pub frozen_groups: Vec<ChatId>,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub group_wasm_version: Version,
    pub local_group_index_wasm_version: Version,
    pub local_group_indexes: Vec<(CanisterId, LocalGroupIndex)>,
    pub canister_ids: CanisterIds,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct CachedMetrics {
    pub last_run: TimestampMillis,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub group_deleted_notifications_pending: u64,
    pub frozen_groups: Vec<ChatId>,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
}

enum LookupUserError {
    UserNotFound,
    InternalError(String),
}

async fn lookup_user(caller: Principal, user_index_canister_id: CanisterId) -> Result<UserDetails, LookupUserError> {
    let args = user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: caller,
    };

    match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &args).await {
        Ok(user_index_canister::c2c_lookup_user::Response::Success(user)) => Ok(user),
        Ok(_) => Err(LookupUserError::UserNotFound),
        Err(error) => Err(LookupUserError::InternalError(format!("{error:?}"))),
    }
}
