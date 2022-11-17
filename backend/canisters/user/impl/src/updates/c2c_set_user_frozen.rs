use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::c2c_set_user_frozen::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_set_user_frozen(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_set_user_frozen_impl(args.frozen, state))
}

fn c2c_set_user_frozen_impl(frozen: bool, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let groups = runtime_state.data.group_chats.iter().map(|g| g.chat_id).collect();

    runtime_state.data.frozen = Timestamped::new(frozen, now);

    Success(SuccessResult { groups })
}
