use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use storage_index_canister::upgrade_bucket_canister_wasm::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn upgrade_bucket_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_bucket_canister_wasm_impl(args, state))
}

fn upgrade_bucket_canister_wasm_impl(args: Args, state: &mut RuntimeState) -> Response {
    let canisters_to_upgrade: Vec<_> = state
        .data
        .buckets
        .iter()
        .filter(|b| b.wasm_version < args.wasm.version)
        .map(|b| b.canister_id)
        .collect();

    if canisters_to_upgrade.is_empty() && state.data.buckets.iter().next().is_some() {
        VersionNotHigher
    } else {
        state.data.bucket_canister_wasm = args.wasm;
        for canister_id in canisters_to_upgrade {
            state.data.canisters_requiring_upgrade.enqueue(canister_id, false);
        }
        Success
    }
}
