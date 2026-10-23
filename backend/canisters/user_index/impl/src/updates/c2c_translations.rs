use crate::guards::caller_is_translations_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{OpenChatBotMessageV2, UserIndexEvent};
use types::{MessageContentInitial, TextContent};
use user_index_canister::c2c_translations::*;
use user_index_canister::{OpenChatBotMessage, TranslationsEvent};

#[update(guard = "caller_is_translations_canister", msgpack = true)]
#[trace]
fn c2c_translations(args: Args) -> Response {
    mutate_state(|state| c2c_translations_impl(args, state))
}

fn c2c_translations_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.translations_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                TranslationsEvent::SendOpenChatBotMessage(message) => send_openchat_bot_message(message, state),
            }
        }
    }
    Response::Success
}

fn send_openchat_bot_message(message: OpenChatBotMessage, state: &mut RuntimeState) {
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
