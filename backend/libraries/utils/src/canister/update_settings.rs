use crate::canister::convert_cdk_error;
use candid::Principal;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, CanisterSettings, UpdateSettingsArgs};
use tracing::error;
use types::CanisterId;

pub async fn set_controllers(canister_id: CanisterId, controllers: Vec<Principal>) -> Result<(), (RejectCode, String)> {
    management_canister::update_settings(&UpdateSettingsArgs {
        canister_id,
        settings: CanisterSettings {
            controllers: Some(controllers),
            ..Default::default()
        },
    })
    .await
    .map_err(|error| {
        let (code, msg) = convert_cdk_error(error);
        error!(
            %canister_id,
            error_code = %code,
            error_message = msg.as_str(),
            "Error calling update_settings"
        );
        (code, msg)
    })
}
