use crate::canister::{convert_cdk_error, install_basic};
use candid::{CandidType, Principal};
use ic_cdk::management_canister::{self, CanisterSettings, CreateCanisterArgs};
use tracing::error;
use types::{C2CError, CanisterId, CanisterWasm, Cycles};

pub async fn create_and_install<A: CandidType>(
    existing_canister_id: Option<CanisterId>,
    wasm: CanisterWasm,
    init_args: A,
    cycles_to_use: Cycles,
    on_canister_created: fn(Cycles) -> (),
) -> Result<CanisterId, (Option<CanisterId>, C2CError)> {
    let canister_id = match existing_canister_id {
        Some(id) => id,
        None => match create(cycles_to_use).await {
            Err(error) => {
                return Err((None, error));
            }
            Ok(id) => {
                on_canister_created(cycles_to_use);
                id
            }
        },
    };

    match install_basic(canister_id, wasm, init_args).await {
        Ok(_) => Ok(canister_id),
        Err(error) => Err((Some(canister_id), error)),
    }
}

pub async fn create(cycles_to_use: Cycles) -> Result<Principal, C2CError> {
    match management_canister::create_canister_with_extra_cycles(
        &CreateCanisterArgs {
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::api::canister_self()]),
                ..Default::default()
            }),
        },
        cycles_to_use.saturating_sub(ic_cdk::api::cost_create_canister()),
    )
    .await
    {
        Ok(x) => Ok(x.canister_id),
        Err(e) => {
            let error = convert_cdk_error(CanisterId::management_canister(), "create_canister", e);
            error!(?error, "Error calling create_canister");
            Err(error)
        }
    }
}
