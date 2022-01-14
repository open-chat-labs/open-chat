use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, RuntimeState, MIN_CYCLES_BALANCE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{UserId, Version};
use user_index_canister::upgrade_canister::{Response::*, *};
use utils::canister;
use utils::canister::CanisterToUpgrade;
use utils::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use utils::cycles::can_spend_cycles;

#[update]
#[trace]
async fn upgrade_canister(_args: Args) -> Response {
    let canister_to_upgrade = match mutate_state(|state| initialize_upgrade(None, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let canister_id = canister_to_upgrade.canister_id;
    let user_id = canister_id.into();
    let to_version = canister_to_upgrade.new_wasm.version;

    match canister::upgrade(canister_to_upgrade).await {
        Ok(_) => {
            mutate_state(|state| set_upgrade_complete(user_id, Some(to_version), state));
            Success
        }
        Err(error) => {
            mutate_state(|state| set_upgrade_complete(user_id, None, state));
            InternalError(format!("{error:?}"))
        }
    }
}

// Confirm the user has a canister that needs upgrading.
// Extract the user canister_id from the runtime state.
// Set the user upgrade_in_progress flag to true.
pub(crate) fn initialize_upgrade(
    user_id: Option<UserId>,
    runtime_state: &mut RuntimeState,
) -> Result<CanisterToUpgrade<user_canister::post_upgrade::Args>, Response> {
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

            let cycles_to_deposit_if_needed = if can_spend_cycles(CYCLES_REQUIRED_FOR_UPGRADE, MIN_CYCLES_BALANCE) {
                Some(CYCLES_REQUIRED_FOR_UPGRADE)
            } else {
                None
            };

            match runtime_state.data.users.update(clone) {
                UpdateUserResult::Success => Ok(CanisterToUpgrade {
                    canister_id,
                    current_wasm_version,
                    new_wasm: user_canister_wasm.clone(),
                    cycles_to_deposit_if_needed,
                    args: user_canister::post_upgrade::Args {
                        wasm_version: user_canister_wasm.version,
                    },
                }),
                result => Err(InternalError(format!("{result:?}"))),
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
