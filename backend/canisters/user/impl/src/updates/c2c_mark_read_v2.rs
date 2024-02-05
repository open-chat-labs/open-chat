use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::UserId;
use user_canister::c2c_mark_read_v2::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_mark_read_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_mark_read_impl(args, state.env.caller().into(), state))
}

pub(crate) fn c2c_mark_read_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();
        if chat.mark_read_up_to(args.read_up_to, false, now) {
            Success
        } else {
            SuccessNoChange
        }
    } else {
        ChatNotFound
    }
}
