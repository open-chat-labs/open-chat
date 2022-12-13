use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_add_initial_groups::{Args, Response};
use tracing::info;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_add_initial_groups(args: Args) -> Response {
    mutate_state(|state| c2c_add_initial_groups_impl(args, state))
}

fn c2c_add_initial_groups_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let group_count = args.groups.len();
    for group in args.groups {
        runtime_state.data.local_groups.add(group.chat_id, group.wasm_version);
    }
    info!(group_count, "Initial groups added");
    Response::Success
}
