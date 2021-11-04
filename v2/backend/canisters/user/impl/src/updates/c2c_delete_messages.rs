use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::UserId;
use user_canister::c2c_delete_messages::{Response::*, *};

#[update]
#[trace]
fn c2c_delete_messages(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        for message_id in args.message_ids.into_iter() {
            chat.events.delete_message(caller, false, message_id, now);
        }

        Success
    } else {
        ChatNotFound
    }
}
