use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{ChatId, UserId};
use user_canister::c2c_mark_read_v2::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_mark_read_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_mark_read_impl(args, state))
}

fn c2c_mark_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let their_user_id: UserId = state.env.caller().into();
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
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
