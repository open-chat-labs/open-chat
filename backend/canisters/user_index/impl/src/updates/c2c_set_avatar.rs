use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_set_avatar::{Response::*, *};

#[update_msgpack(guard = "caller_is_openchat_user")]
#[trace]
fn c2c_set_avatar(args: Args) -> Response {
    mutate_state(|state| c2c_set_avatar_impl(args, state))
}

fn c2c_set_avatar_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state.data.users.set_avatar_id(&caller.into(), args.avatar_id, now) {
        true => Success,
        false => UserNotFound,
    }
}
