use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::UserId;
use user_canister::c2c_undelete_messages::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_undelete_messages_impl(args, state))
}

fn c2c_undelete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        chat.events.undelete_messages(
            caller,
            false,
            None,
            args.message_ids,
            args.correlation_id,
            runtime_state.env.now(),
        );
        Success
    } else {
        ChatNotFound
    }
}
