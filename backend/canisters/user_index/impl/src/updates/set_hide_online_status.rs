use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::SuccessOnly::Success;
use user_index_canister::set_hide_online_status::*;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn set_hide_online_status(args: Args) -> Response {
    mutate_state(|state| set_hide_online_status_impl(args, state))
}

fn set_hide_online_status_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = state.data.users.get(&caller).unwrap().user_id;
    let now = state.env.now();
    state
        .data
        .users
        .set_hide_online_status(&user_id, args.hide_online_status, now);

    Success
}
