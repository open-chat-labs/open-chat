use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::update_group_canister_wasm::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn update_group_canister_wasm(args: Args) -> Response {
    RUNTIME_STATE.with(|state| update_group_canister_wasm_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn update_group_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let permitted_callers = &runtime_state.data.service_principals;

    if !permitted_callers.contains(&caller) {
        return NotAuthorized;
    }

    if args.group_canister_wasm.version <= runtime_state.data.group_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.group_canister_wasm = args.group_canister_wasm;

        for chat_id in runtime_state
            .data
            .public_groups
            .iter()
            .map(|g| g.id())
            .chain(runtime_state.data.private_groups.iter().map(|g| g.id()))
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(chat_id);
        }
        Success
    }
}
