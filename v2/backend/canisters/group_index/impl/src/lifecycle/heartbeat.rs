use crate::model::canisters_requiring_upgrade::FailedUpgrade;
use crate::{RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MIN_CYCLES_BALANCE, RUNTIME_STATE};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, CanisterWasm, ChatId, Cycles, Version};
use utils::canister;
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

const MAX_CANISTER_UPGRADES_PER_HEARTBEAT: u32 = 3;

#[heartbeat]
fn heartbeat() {
    topup_canister_pool::run();
    upgrade_canisters::run();
}

mod upgrade_canisters {
    use super::*;

    pub fn run() {
        let chats_to_upgrade = RUNTIME_STATE.with(|state| get_next_batch(state.borrow_mut().as_mut().unwrap()));
        if !chats_to_upgrade.is_empty() {
            ic_cdk::block_on(perform_upgrades(chats_to_upgrade));
        }
    }

    struct ChatToUpgrade {
        chat_id: ChatId,
        current_wasm_version: Version,
        new_wasm: CanisterWasm,
    }

    fn get_next_batch(runtime_state: &mut RuntimeState) -> Vec<ChatToUpgrade> {
        (0..MAX_CANISTER_UPGRADES_PER_HEARTBEAT)
            // TODO replace this with 'map_while' once we have upgraded to Rust 1.57
            .map(|_| try_get_next(runtime_state))
            .take_while(|c| c.is_some())
            .map(|c| c.unwrap())
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<ChatToUpgrade> {
        let chat_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        let current_wasm_version = runtime_state
            .data
            .public_groups
            .get(&chat_id)
            .map(|g| g.wasm_version())
            .or_else(|| runtime_state.data.private_groups.get(&chat_id).map(|g| g.wasm_version()))?;

        Some(ChatToUpgrade {
            chat_id,
            current_wasm_version,
            new_wasm: runtime_state.data.group_canister_wasm.clone(),
        })
    }

    async fn perform_upgrades(chats_to_update: Vec<ChatToUpgrade>) {
        let futures: Vec<_> = chats_to_update.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(chat_to_update: ChatToUpgrade) {
        let chat_id = chat_to_update.chat_id;
        let from_version = chat_to_update.current_wasm_version;
        let to_version = chat_to_update.new_wasm.version;
        let success = canister::upgrade(chat_id.into(), chat_to_update.new_wasm.module)
            .await
            .is_ok();

        RUNTIME_STATE.with(|state| {
            mark_complete(
                chat_id,
                success,
                from_version,
                to_version,
                state.borrow_mut().as_mut().unwrap(),
            )
        });
    }

    fn mark_complete(
        chat_id: ChatId,
        success: bool,
        from_version: Version,
        to_version: Version,
        runtime_state: &mut RuntimeState,
    ) {
        if success {
            runtime_state.data.canisters_requiring_upgrade.mark_success(&chat_id);
            if let Some(chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
                chat.set_wasm_version(to_version);
            } else if let Some(chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
                chat.set_wasm_version(to_version);
            }
        } else {
            runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
                chat_id,
                from_version,
                to_version,
            });
        }
    }
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let is_full = RUNTIME_STATE.with(|state| is_pool_full(state.borrow().as_ref().unwrap()));
        if !is_full {
            let cycles_balance: Cycles = ic_cdk::api::canister_balance().into();
            let cycles_to_use = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
            if cycles_balance.saturating_sub(cycles_to_use) > MIN_CYCLES_BALANCE {
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
