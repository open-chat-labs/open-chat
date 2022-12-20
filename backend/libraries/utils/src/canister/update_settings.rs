use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::CanisterId;

pub async fn set_controllers(canister_id: CanisterId, controllers: Vec<Principal>) -> Result<(), canister::Error> {
    let args = UpdateSettingsArgs {
        canister_id,
        settings: CanisterSettings {
            controllers: Some(controllers),
            controller: None,
            compute_allocation: None,
            memory_allocation: None,
            freezing_threshold: None,
        },
    };

    let _: () = match api::call::call(Principal::management_canister(), "update_settings", (args,)).await {
        Ok(x) => x,
        Err((code, msg)) => {
            error!(
                error_code = code as u8,
                error_message = msg.as_str(),
                "Error calling update_settings"
            );
            return Err(canister::Error { code, msg });
        }
    };

    Ok(())
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct UpdateSettingsArgs {
    canister_id: Principal,
    settings: CanisterSettings,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct CanisterSettings {
    pub controller: Option<Principal>,
    pub controllers: Option<Vec<Principal>>,
    pub compute_allocation: Option<candid::Nat>,
    pub memory_allocation: Option<candid::Nat>,
    pub freezing_threshold: Option<candid::Nat>,
}
