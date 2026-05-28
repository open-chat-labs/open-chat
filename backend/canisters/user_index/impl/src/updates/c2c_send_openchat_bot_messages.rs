use crate::{RuntimeState, guards::caller_is_translations_canister, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{OpenChatBotMessageV2, UserIndexEvent};
use types::{MessageContentInitial, TextContent};
use user_index_canister::c2c_send_openchat_bot_messages::*;

#[update(guard = "caller_is_translations_canister", msgpack = true)]
#[trace]
fn c2c_send_openchat_bot_messages(args: Args) -> Response {
    mutate_state(|state| c2c_send_openchat_bot_messages_impl(args, state))
}

fn c2c_send_openchat_bot_messages_impl(args: Args, state: &mut RuntimeState) -> Response {
    for message in args.messages {
        state.push_event_to_local_user_index(
            message.recipient,
            UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                user_id: message.recipient,
                thread_root_message_id: None,
                content: MessageContentInitial::Text(TextContent { text: message.text }),
                mentioned: Vec::new(),
            })),
        );
    }

    Response::Success
}
