use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::delete_messages::{Response::*, *};

#[update]
fn delete_messages(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = runtime_state.env.now();

        for message_id in args.message_ids.into_iter() {
            chat.events.delete_message(message_id, now);
        }

        Success
    } else {
        ChatNotFound
    }
}
