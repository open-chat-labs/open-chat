use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_update_user_principal::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_update_user_principal(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.owner = args.new_principal;

    let canisters_to_notify = state
        .data
        .group_chats
        .iter()
        .map(|g| g.chat_id.into())
        .chain(state.data.communities.iter().map(|c| c.community_id.into()))
        .collect();

    Success(SuccessResult { canisters_to_notify })
}
