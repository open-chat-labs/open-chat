use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use tracing::info;
use types::{CanisterId, CanisterWasm, UpgradeCanisterWasmArgs, UpgradesFilter};
use user_index_canister::upgrade_user_canister_wasm::{Response::*, *};
use utils::canister::build_filter_map;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn upgrade_user_canister_wasm(args: Args) -> Response {
    let version = args.wasm.version;
    let use_for_new_canisters = args.use_for_new_canisters.unwrap_or(true);

    let PrepareResult {
        wasm,
        local_user_index_canisters,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let futures: Vec<_> = local_user_index_canisters
        .into_iter()
        .map(|(canister_id, filter)| {
            c2c_upgrade_user_canister_wasm(
                canister_id,
                UpgradeCanisterWasmArgs {
                    wasm: wasm.clone(),
                    filter: Some(filter),
                    use_for_new_canisters: Some(use_for_new_canisters),
                },
            )
        })
        .collect();

    let result = futures::future::join_all(futures).await;

    if let Some(first_error) = result.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{first_error:?}"))
    } else {
        if use_for_new_canisters {
            mutate_state(|state| {
                state.data.user_canister_wasm = wasm;
            });
        }

        info!(%version, "User canister wasm upgraded");
        Success
    }
}

struct PrepareResult {
    wasm: CanisterWasm,
    local_user_index_canisters: Vec<(CanisterId, UpgradesFilter)>,
}

fn prepare(args: Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.test_mode && args.wasm.version < state.data.user_canister_wasm.version {
        return Err(VersionNotHigher);
    }

    let local_user_index_canister_ids: Vec<_> = state.data.local_index_map.canisters().copied().collect();

    let local_user_index_canisters = build_filter_map(local_user_index_canister_ids, args.filter.unwrap_or_default(), |c| {
        state.data.local_index_map.get_index_canister(&c.into())
    });

    Ok(PrepareResult {
        wasm: args.wasm,
        local_user_index_canisters,
    })
}

async fn c2c_upgrade_user_canister_wasm(
    canister_id: CanisterId,
    args: local_user_index_canister::c2c_upgrade_user_canister_wasm::Args,
) -> CallResult<local_user_index_canister::c2c_upgrade_user_canister_wasm::Response> {
    local_user_index_canister_c2c_client::c2c_upgrade_user_canister_wasm(canister_id, &args).await
}
