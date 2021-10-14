use crate::{regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use user_canister::c2c_delete_messages::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn c2c_delete_messages(args: Args) -> Response {
    regular_jobs::run();

    RUNTIME_STATE.with(|state| c2c_delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let caller_user_id = caller.into();
        let now = runtime_state.env.now();

        for message_id in args.message_ids.into_iter() {
            chat.events.delete_message(caller_user_id, false, message_id, now);
        }

        Success
    } else {
        ChatNotFound
    }
}
