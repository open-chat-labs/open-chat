use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use ic_cdk_macros::update;
use types::{CanisterId, MessageContent, MessageId};
use user_canister::c2c_edit_message;
use user_canister::edit_message::{Response::*, *};

#[update]
#[trace]
fn edit_message(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| edit_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn edit_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: my_user_id,
            message_id: args.message_id,
            content: args.content.clone(),
            now,
        };

        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                ic_cdk::block_on(edit_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.content,
                ));
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}

async fn edit_on_recipients_canister(canister_id: CanisterId, message_id: MessageId, content: MessageContent) {
    let args = c2c_edit_message::Args { message_id, content };
    let _ = user_canister_c2c_client::c2c_edit_message(canister_id, &args).await;
}
