use candid::Principal;
use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterSettings, UpdateSettingsArgument};
use tracing::error;
use types::CanisterId;

pub async fn set_controllers(canister_id: CanisterId, controllers: Vec<Principal>) -> CallResult<()> {
    management_canister::main::update_settings(UpdateSettingsArgument {
        canister_id,
        settings: CanisterSettings {
            controllers: Some(controllers),
            ..Default::default()
        },
    })
    .await
    .map_err(|(code, msg)| {
        error!(
            %canister_id,
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling update_settings"
        );
        (code, msg)
    })
}
