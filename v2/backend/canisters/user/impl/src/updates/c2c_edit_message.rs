use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::{EditMessageArgs, EditMessageResult};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use tracing::instrument;
use user_canister::edit_message::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn c2c_edit_messages(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_edit_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_edit_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let caller_user_id = caller.into();
        let now = runtime_state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: caller_user_id,
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
