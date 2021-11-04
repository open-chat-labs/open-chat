use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use ic_cdk_macros::update;
use types::UserId;
use user_canister::edit_message::{Response::*, *};

#[update]
#[trace]
fn c2c_edit_messages(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_edit_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_edit_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: caller,
            message_id: args.message_id,
            content: args.content,
            now,
        };

        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => Success,
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
