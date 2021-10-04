use crate::model::canisters_requiring_upgrade::FailedUpgrade;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::heartbeat;
use types::{CanisterWasm, ChatId, Version};
use utils::canisters::upgrade;

const MAX_CANISTER_UPGRADES_PER_HEARTBEAT: u32 = 3;

#[heartbeat]
fn heartbeat() {
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
        let success = upgrade::call(chat_id.into(), chat_to_update.new_wasm.module).await.is_ok();

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
