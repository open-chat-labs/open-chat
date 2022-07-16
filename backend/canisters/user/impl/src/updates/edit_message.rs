use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use ic_cdk_macros::update;
use types::{CanisterId, MessageContent, MessageId};
use user_canister::c2c_edit_message;
use user_canister::edit_message::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn edit_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.blocked_users.contains(&args.user_id) {
        UserBlocked
    } else if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: my_user_id,
            thread_root_message_index: None,
            message_id: args.message_id,
            content: args.content.clone(),
            now,
        };

        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                ic_cdk::spawn(edit_on_recipients_canister(
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
