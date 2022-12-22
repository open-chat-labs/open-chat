use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::{mutate_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, ChatId, Cycles, CyclesTopUp, DeletedGroupInfo, UserId, Version};
use utils::canister::{upgrade, FailedUpgrade};

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    calculate_hot_groups::run();
    push_group_deleted_notifications::run();
    calculate_metrics::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<local_group_index_canister::post_upgrade::Args>;

    pub fn run() {
        let chats_to_upgrade = mutate_state(next_batch);
        if !chats_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(chats_to_upgrade));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = runtime_state.data.canisters_requiring_upgrade.count_in_progress();
        let max_concurrent_canister_upgrades = runtime_state.data.max_concurrent_local_group_index_canister_upgrades;

        (0..(max_concurrent_canister_upgrades.saturating_sub(count_in_progress)))
            .map_while(|_| try_get_next(runtime_state))
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        let current_wasm_version = match runtime_state.data.local_index_map.get(&canister_id) {
            Some(local_group_index) => local_group_index.wasm_version(),
            None => {
                runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
                return None;
            }
        };

        let new_wasm = runtime_state.data.local_group_index_canister_wasm.clone();
        let wasm_version = new_wasm.version;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm,
            deposit_cycles_if_needed: false,
            args: local_group_index_canister::post_upgrade::Args { wasm_version },
        })
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match upgrade(canister_to_upgrade).await {
            Ok(cycles_top_up) => {
                mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, top_up: Option<Cycles>, runtime_state: &mut RuntimeState) {
        let local_group_index = runtime_state
            .data
            .local_index_map
            .get_mut(&canister_id)
            .expect("Cannot find local_group_index");

        local_group_index.set_wasm_version(to_version);

        let top_up = top_up.map(|c| CyclesTopUp {
            amount: c,
            date: runtime_state.env.now(),
        });

        if let Some(top_up) = top_up {
            local_group_index.mark_cycles_top_up(top_up);
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}

mod calculate_hot_groups {
    use super::*;

    pub fn run() {
        if let Some(groups) = mutate_state(calculate_hot_groups_if_due) {
            ic_cdk::spawn(set_hot_groups(groups));
        }
    }

    fn calculate_hot_groups_if_due(runtime_state: &mut RuntimeState) -> Option<Vec<ChatId>> {
        let now = runtime_state.env.now();
        if runtime_state.data.cached_hot_groups.start_update_if_due(now) {
            let hot_groups = runtime_state.data.public_groups.calculate_hot_groups(now);

            Some(hot_groups)
        } else {
            None
        }
    }

    async fn set_hot_groups(chat_ids: Vec<ChatId>) {
        let hydrated = hydrate_hot_groups(chat_ids).await;

        mutate_state(|state| {
            let now = state.env.now();
            state.data.cached_hot_groups.update(hydrated, now);
        })
    }

    async fn hydrate_hot_groups(chat_ids: Vec<ChatId>) -> Vec<CachedPublicGroupSummary> {
        use group_canister::public_summary::{Args, Response};

        let args = Args { invite_code: None };

        let futures: Vec<_> = chat_ids
            .into_iter()
            .map(|chat_id| group_canister_c2c_client::public_summary(chat_id.into(), &args))
            .collect();

        let responses = futures::future::join_all(futures).await;

        responses
            .into_iter()
            .filter_map(|r| if let Ok(Response::Success(result)) = r { Some(result) } else { None })
            .map(|r| r.summary.into())
            .collect()
    }
}

mod push_group_deleted_notifications {
    use super::*;

    const MAX_BATCH_SIZE: usize = 100;

    pub fn run() {
        let batch = mutate_state(next_batch);
        if !batch.is_empty() {
            ic_cdk::spawn(push_notifications(batch));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<(UserId, DeletedGroupInfo)> {
        (0..MAX_BATCH_SIZE)
            .map_while(|_| runtime_state.data.deleted_groups.dequeue_group_deleted_notification())
            .collect()
    }

    async fn push_notifications(notifications: Vec<(UserId, DeletedGroupInfo)>) {
        let futures: Vec<_> = notifications.into_iter().map(|(u, d)| push_notification(u, d)).collect();

        futures::future::join_all(futures).await;
    }

    async fn push_notification(user_id: UserId, deleted_group: DeletedGroupInfo) {
        let args = user_canister::c2c_notify_group_deleted::Args { deleted_group };
        // TODO handle case where this fails
        let _ = user_canister_c2c_client::c2c_notify_group_deleted(user_id.into(), &args).await;
    }
}

mod calculate_metrics {
    use super::*;

    pub fn run() {
        mutate_state(calculate_metrics);
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.calculate_metrics(now);
    }
}
