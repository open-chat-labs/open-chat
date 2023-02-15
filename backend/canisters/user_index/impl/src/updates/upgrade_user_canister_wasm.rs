use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use tracing::info;
use types::{CanisterId, Version};
use user_index_canister::upgrade_user_canister_wasm::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn upgrade_user_canister_wasm(args: Args) -> Response {
    let version = args.wasm.version;

    let local_user_index_canisters = match read_state(|state| prepare(version, state)) {
        Ok(canisters) => canisters,
        Err(response) => return response,
    };

    let futures: Vec<_> = local_user_index_canisters
        .into_iter()
        .map(|canister_id| local_user_index_canister_c2c_client::c2c_upgrade_user_canister_wasm(canister_id, &args))
        .collect();

    let result = futures::future::join_all(futures).await;

    if let Some(first_error) = result.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{first_error:?}"))
    } else {
        mutate_state(|state| {
            state.data.user_canister_wasm = args.wasm;
        });

        info!(%version, "User canister wasm upgraded");
        Success
    }
}

fn prepare(version: Version, runtime_state: &RuntimeState) -> Result<Vec<CanisterId>, Response> {
    if !runtime_state.data.test_mode && version < runtime_state.data.user_canister_wasm.version {
        return Err(VersionNotHigher);
    }

    Ok(runtime_state.data.local_index_map.canisters().copied().collect())
}
