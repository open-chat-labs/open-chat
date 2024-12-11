use crate::{guards::caller_is_translations_canister, mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{OpenChatBotMessage, UserIndexToLocalUserIndexEvent};
use types::{MessageContent, TextContent};
use user_index_canister::c2c_send_openchat_bot_messages::{Response::*, *};

#[update(guard = "caller_is_translations_canister", msgpack = true)]
#[trace]
fn c2c_send_openchat_bot_messages(args: Args) -> Response {
    mutate_state(|state| c2c_send_openchat_bot_messages_impl(args, state))
}

fn c2c_send_openchat_bot_messages_impl(args: Args, state: &mut RuntimeState) -> Response {
    for message in args.messages {
        state.push_event_to_local_user_index(
            message.recipient,
            UserIndexToLocalUserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
                user_id: message.recipient,
                message: MessageContent::Text(TextContent { text: message.text }),
            })),
        );
    }

    Success
}
