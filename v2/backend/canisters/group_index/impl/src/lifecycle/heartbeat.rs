use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::heartbeat;
use types::ChatId;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
}

mod upgrade_canisters {
    use super::*;
    use crate::model::canisters_requiring_upgrade::FailedUpgrade;
    use types::{CanisterWasm, Version};
    use utils::canisters::upgrade;

    pub fn run() {
        if let Some(chat_to_upgrade) = RUNTIME_STATE.with(|state| try_get_next(state.borrow_mut().as_mut().unwrap())) {
            ic_cdk::block_on(perform_upgrade(chat_to_upgrade));
        }
    }

    struct ChatToUpgrade {
        chat_id: ChatId,
        current_wasm_version: Version,
        new_wasm: CanisterWasm,
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
