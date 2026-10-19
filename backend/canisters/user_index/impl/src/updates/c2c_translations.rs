use crate::guards::caller_is_translations_canister;
use crate::updates::c2c_send_openchat_bot_messages::c2c_send_openchat_bot_messages_impl;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::c2c_translations::*;
use user_index_canister::{TranslationsEvent, c2c_send_openchat_bot_messages};

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
                TranslationsEvent::SendOpenChatBotMessage(message) => {
                    c2c_send_openchat_bot_messages_impl(
                        c2c_send_openchat_bot_messages::Args { messages: vec![message] },
                        state,
                    );
                }
            }
        }
    }
    Response::Success
}
