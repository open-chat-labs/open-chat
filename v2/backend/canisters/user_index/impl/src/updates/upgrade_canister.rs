use crate::model::user_map::UpdateUserResult;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use types::{UserId, Version};
use user_index_canister::upgrade_canister::{Response::*, *};
use utils::canister;
use utils::canister::CanisterToUpgrade;

#[update]
#[instrument(level = "trace")]
async fn upgrade_canister(_: Args) -> Response {
    let canister_to_upgrade = match RUNTIME_STATE.with(|state| initialize_upgrade(None, state.borrow_mut().as_mut().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let canister_id = canister_to_upgrade.canister_id;
    let user_id = canister_id.into();
    let to_version = canister_to_upgrade.new_wasm.version;

    match canister::upgrade(canister_id, canister_to_upgrade.new_wasm.module).await {
        Ok(_) => {
            RUNTIME_STATE.with(|state| set_upgrade_complete(user_id, Some(to_version), state.borrow_mut().as_mut().unwrap()));
            Success
        }
        Err(error) => {
            RUNTIME_STATE.with(|state| set_upgrade_complete(user_id, None, state.borrow_mut().as_mut().unwrap()));
            InternalError(format!("{:?}", error))
        }
    }
}

// Confirm the user has a canister that needs upgrading.
// Extract the user canister_id from the runtime state.
// Set the user upgrade_in_progress flag to true.
pub(crate) fn initialize_upgrade(
    user_id: Option<UserId>,
    runtime_state: &mut RuntimeState,
) -> Result<CanisterToUpgrade, Response> {
    let user = if let Some(user_id) = user_id {
        runtime_state.data.users.get_by_user_id(&user_id)
    } else {
        let caller = runtime_state.env.caller();
        runtime_state.data.users.get_by_principal(&caller)
    };

    let user = user.ok_or(UserNotFound)?;
    let canister_id = user.get_user_id().map(|u| u.into()).ok_or(UserNotCreated)?;

    let user_canister_wasm = &runtime_state.data.user_canister_wasm;
    if user.upgrade_in_progress() {
        Err(UpgradeInProgress)
    } else {
        let current_wasm_version = user.wasm_version().unwrap_or_else(Version::min);
        if current_wasm_version >= user_canister_wasm.version {
            Err(UpgradeNotRequired)
        } else {
            let mut clone = user.clone();
            clone.set_canister_upgrade_status(true, None);
            match runtime_state.data.users.update(clone) {
                UpdateUserResult::Success => Ok(CanisterToUpgrade {
                    canister_id,
                    current_wasm_version,
                    new_wasm: user_canister_wasm.clone(),
                }),
                r => Err(InternalError(format!("{:?}", r))),
            }
        }
    }
}

pub(crate) fn set_upgrade_complete(user_id: UserId, new_wasm_version: Option<Version>, runtime_state: &mut RuntimeState) {
    if let Some(user) = runtime_state.data.users.get_by_user_id(&user_id) {
        let mut user = user.clone();
        user.set_canister_upgrade_status(false, new_wasm_version);
        runtime_state.data.users.update(user);
    }
}
