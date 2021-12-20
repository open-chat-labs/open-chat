use crate::guards::caller_is_controller;
use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::update_user_canister_wasm::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
fn update_user_canister_wasm(args: Args) -> Response {
    RUNTIME_STATE.with(|state| update_user_canister_wasm_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn update_user_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if args.user_canister_wasm.version <= runtime_state.data.user_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.user_canister_wasm = args.user_canister_wasm.decompress();
        for user_id in runtime_state.data.users.iter().filter_map(|u| u.get_user_id()) {
            runtime_state.data.canisters_requiring_upgrade.enqueue(user_id.into())
        }
        Success
    }
}
