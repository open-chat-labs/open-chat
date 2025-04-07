use crate::canister::convert_cdk_error;
use candid::Principal;
use ic_cdk::management_canister::{self, CanisterSettings, UpdateSettingsArgs};
use tracing::error;
use types::{C2CError, CanisterId};

pub async fn set_controllers(canister_id: CanisterId, controllers: Vec<Principal>) -> Result<(), C2CError> {
    management_canister::update_settings(&UpdateSettingsArgs {
        canister_id,
        settings: CanisterSettings {
            controllers: Some(controllers),
            ..Default::default()
        },
    })
    .await
    .map_err(|e| {
        let error = convert_cdk_error(canister_id, "update_settings", e);
        error!(?error, "Error calling update_settings");
        error
    })
}
