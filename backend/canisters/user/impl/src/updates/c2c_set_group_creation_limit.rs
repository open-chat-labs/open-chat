use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_set_group_creation_limit::{Response::*, *};

#[update_candid_and_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_set_group_creation_limit(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_set_group_creation_limit_impl(args, state))
}

fn c2c_set_group_creation_limit_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.group_creation_limit = args.group_creation_limit;
    Success
}
