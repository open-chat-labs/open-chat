use crate::canister::convert_cdk_error;
use candid::Principal;
use ic_cdk::management_canister::{self, CanisterSettings, UpdateSettingsArgs};
use tracing::error;
use types::{C2CError, CanisterId, Cycles};

pub async fn set_controllers(canister_id: CanisterId, controllers: Vec<Principal>) -> Result<(), C2CError> {
    update_settings(
        canister_id,
        CanisterSettings {
            controllers: Some(controllers),
            ..Default::default()
        },
    )
    .await
}

pub async fn set_reserved_cycles_limit(canister_id: CanisterId, cycles: Cycles) -> Result<(), C2CError> {
    update_settings(
        canister_id,
        CanisterSettings {
            reserved_cycles_limit: Some(cycles.into()),
            ..Default::default()
        },
    )
    .await
}

pub async fn update_settings(canister_id: CanisterId, settings: CanisterSettings) -> Result<(), C2CError> {
    management_canister::update_settings(&UpdateSettingsArgs { canister_id, settings })
        .await
        .map_err(|e| {
            let error = convert_cdk_error(canister_id, "update_settings", e);
            error!(?error, "Error calling update_settings");
            error
        })
}
