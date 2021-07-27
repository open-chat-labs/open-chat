use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_index_canister::updates::update_wasm::{Response::*, *};

#[update]
fn update_wasm(args: Args) -> Response {
    RUNTIME_STATE.with(|state| update_wasm_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn update_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let permitted_callers = &runtime_state.data.service_principals;

    if !permitted_callers.contains(&caller) {
        return NotAuthorized;
    }

    if args.version <= runtime_state.data.user_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.user_wasm.version = args.version;
        runtime_state.data.user_wasm.module = args.user_wasm_module;
        Success
    }
}
