use crate::updates::upgrade_canister::{initialize_upgrade, set_upgrade_complete};
use crate::{RuntimeState, MIN_CYCLES_BALANCE, RUNTIME_STATE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use group_canister::c2c_dismiss_super_admin;
use ic_cdk_macros::heartbeat;
use tracing::error;
use types::{CanisterId, ChatId, Cycles, UserId, Version};
use utils::canister;
use utils::canister::FailedUpgrade;
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

const MAX_CONCURRENT_CANISTER_UPGRADES: u32 = 5;
const MAX_MESSAGES_TO_RETRY_PER_HEARTBEAT: u32 = 5;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    retry_failed_messages::run();
    calculate_metrics::run();
    dismiss_removed_super_admins::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<user_canister::post_upgrade::Args>;

    pub fn run() {
        let canisters_to_upgrade = RUNTIME_STATE.with(|state| get_next_batch(state.borrow_mut().as_mut().unwrap()));
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::block_on(perform_upgrades(canisters_to_upgrade));
        }
    }

    fn get_next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = runtime_state.data.canisters_requiring_upgrade.count_in_progress();
        (0..(MAX_CONCURRENT_CANISTER_UPGRADES - count_in_progress))
            // TODO replace this with 'map_while' once we have upgraded to Rust 1.57
            .map(|_| try_get_next(runtime_state))
            .take_while(|c| c.is_some())
            .map(|c| c.unwrap())
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        initialize_upgrade(Some(canister_id.into()), runtime_state).ok()
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match canister::upgrade(canister_id, canister_to_upgrade.new_wasm.module, canister_to_upgrade.args).await {
            Ok(_) => {
                RUNTIME_STATE.with(|state| on_success(canister_id, to_version, state.borrow_mut().as_mut().unwrap()));
            }
            Err(_) => {
                RUNTIME_STATE
                    .with(|state| on_failure(canister_id, from_version, to_version, state.borrow_mut().as_mut().unwrap()));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, runtime_state: &mut RuntimeState) {
        set_upgrade_complete(canister_id.into(), Some(to_version), runtime_state);
        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        set_upgrade_complete(canister_id.into(), None, runtime_state);
        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let is_full = RUNTIME_STATE.with(|state| is_pool_full(state.borrow().as_ref().unwrap()));
        if !is_full {
            let cycles_to_use = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

            // Only create the new canister if it won't result in the cycles balance being too low
            if cycles_utils::can_spend_cycles(cycles_to_use, MIN_CYCLES_BALANCE) {
                ic_cdk::block_on(add_new_canister(cycles_to_use));
            }
        }
    }

    fn is_pool_full(runtime_state: &RuntimeState) -> bool {
        runtime_state.data.canister_pool.is_full()
    }

    async fn add_new_canister(cycles_to_use: Cycles) {
        if let Ok(canister_id) = canister::create(cycles_to_use).await {
            RUNTIME_STATE.with(|state| add_canister_to_pool(canister_id, cycles_to_use, state.borrow_mut().as_mut().unwrap()));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, runtime_state: &mut RuntimeState) {
        runtime_state.data.canister_pool.push(canister_id);
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}

mod retry_failed_messages {
    use super::*;

    pub fn run() {
        let messages_to_retry = RUNTIME_STATE.with(|state| get_next_batch(state.borrow_mut().as_mut().unwrap()));
        if !messages_to_retry.is_empty() {
            ic_cdk::block_on(send_to_canisters(messages_to_retry));
        }
    }

    fn get_next_batch(runtime_state: &mut RuntimeState) -> Vec<(UserId, UserId)> {
        let canisters_requiring_upgrade = &runtime_state.data.canisters_requiring_upgrade;
        // Filter out canisters that are currently being upgraded
        let filter = |_: &UserId, recipient: &UserId| {
            let canister_id: CanisterId = (*recipient).into();
            !canisters_requiring_upgrade.is_in_progress(&canister_id)
        };

        runtime_state
            .data
            .failed_messages_pending_retry
            .take_oldest(MAX_MESSAGES_TO_RETRY_PER_HEARTBEAT, filter)
    }

    async fn send_to_canisters(messages_to_retry: Vec<(UserId, UserId)>) {
        let futures: Vec<_> = messages_to_retry
            .into_iter()
            .map(|(sender, recipient)| send_to_canister(sender, recipient))
            .collect();

        futures::future::join_all(futures).await;
    }

    async fn send_to_canister(sender: UserId, recipient: UserId) {
        let args = user_canister::c2c_retry_sending_failed_messages::Args { recipient };
        let _ = user_canister_c2c_client::c2c_retry_sending_failed_messages(sender.into(), &args).await;
    }
}

mod calculate_metrics {
    use super::*;

    pub fn run() {
        RUNTIME_STATE.with(|state| calculate_metrics(state.borrow_mut().as_mut().unwrap()));
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.users.calculate_metrics(now);
    }
}

mod dismiss_removed_super_admins {
    use super::*;

    pub fn run() {
        if let Some((user_id, group_id)) =
            RUNTIME_STATE.with(|state| pop_super_admin_to_dismiss(state.borrow_mut().as_mut().unwrap()))
        {
            ic_cdk::block_on(dismiss_super_admin(user_id, group_id));
        }
    }

    fn pop_super_admin_to_dismiss(runtime_state: &mut RuntimeState) -> Option<(UserId, ChatId)> {
        runtime_state.data.super_admins_to_dismiss.pop_front()
    }

    fn push_super_admin_to_dismiss(user_id: UserId, group_id: ChatId, runtime_state: &mut RuntimeState) {
        runtime_state.data.super_admins_to_dismiss.push_back((user_id, group_id));
    }

    async fn dismiss_super_admin(user_id: UserId, group_id: ChatId) {
        let c2c_args = c2c_dismiss_super_admin::Args { user_id };
        if let Err(error) = group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args).await {
            error!(?error, ?user_id, ?group_id, "Error calling group::c2c_dismiss_super_admin");
            RUNTIME_STATE.with(|state| push_super_admin_to_dismiss(user_id, group_id, state.borrow_mut().as_mut().unwrap()));
        }
    }
}
