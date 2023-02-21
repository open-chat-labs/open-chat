use crate::guards::caller_is_service_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::upgrade_bucket_canister_wasm::{Response::*, *};

#[update(guard = "caller_is_service_principal")]
#[trace]
fn upgrade_bucket_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_bucket_canister_wasm_impl(args, state))
}

fn upgrade_bucket_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let canisters_to_upgrade: Vec<_> = runtime_state
        .data
        .buckets
        .iter()
        .filter(|b| b.wasm_version < args.wasm.version)
        .map(|b| b.canister_id)
        .collect();

    if canisters_to_upgrade.is_empty() && runtime_state.data.buckets.iter().next().is_some() {
        VersionNotHigher
    } else {
        runtime_state.data.bucket_canister_wasm = args.wasm;
        for canister_id in canisters_to_upgrade {
            runtime_state.data.canisters_requiring_upgrade.enqueue(canister_id)
        }
        Success
    }
}
