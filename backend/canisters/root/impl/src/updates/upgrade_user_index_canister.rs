use crate::guards::caller_is_controller;
use crate::read_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use root_canister::upgrade_user_index_canister::{Response::*, *};
use types::Version;
use utils::canister::{upgrade, CanisterToUpgrade};

#[update(guard = "caller_is_controller")]
#[trace]
async fn upgrade_user_index_canister(args: Args) -> Response {
    let canister_id = read_state(|state| state.data.user_index_canister_id);
    let wasm_version = args.user_index_canister_wasm.version;
    let new_wasm = args.user_index_canister_wasm.decompress();

    match upgrade(CanisterToUpgrade {
        canister_id,
        current_wasm_version: Version::default(),
        cycles_to_deposit_if_needed: None,
        new_wasm,
        args: user_index_canister::post_upgrade::Args { wasm_version },
    })
    .await
    {
        Ok(_) => Success,
        Err(error) => InternalError(format!("{error:?}")),
    }
}
