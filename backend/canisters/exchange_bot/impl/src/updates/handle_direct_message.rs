use crate::commands::balance::BalanceCommandParser;
use crate::commands::quote::QuoteCommandParser;
use crate::commands::swap::SwapCommandParser;
use crate::commands::withdraw::WithdrawCommandParser;
use crate::commands::{CommandParser, ParseMessageResult};
use crate::{mutate_state, read_state, Data, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use exchange_bot_canister::handle_direct_message::*;
use ledger_utils::format_crypto_amount_with_symbol;
use local_user_index_canister_c2c_client::LookupUserError;
use types::{BotMessage, MessageContent, MessageContentInitial, UserId};

#[update_msgpack]
#[trace]
async fn handle_direct_message(args: Args) -> Response {
    if let Err(error) = verify_caller().await {
        return read_state(|state| build_response(vec![convert_to_message(error)], &state.data));
    };

    mutate_state(|state| handle_direct_message_impl(args.content, state))
}

fn handle_direct_message_impl(message: MessageContent, state: &mut RuntimeState) -> Response {
    let mut command = None;
    let mut response_messages = Vec::new();

    if let MessageContent::Crypto(c) = &message {
        let token = c.transfer.token();
        response_messages.push(convert_to_message(format_crypto_amount_with_symbol(
            c.transfer.units(),
            token.decimals().unwrap_or(8),
            token.token_symbol(),
        )));
    }

    match BalanceCommandParser::try_parse(&message, state) {
        ParseMessageResult::Success(c) => command = Some(c),
        ParseMessageResult::Error(e) => response_messages.push(convert_to_message(e)),
        ParseMessageResult::DoesNotMatch => {}
    };

    if command.is_none() {
        match QuoteCommandParser::try_parse(&message, state) {
            ParseMessageResult::Success(c) => command = Some(c),
            ParseMessageResult::Error(e) => response_messages.push(convert_to_message(e)),
            ParseMessageResult::DoesNotMatch => {}
        };
    }

    if command.is_none() {
        match SwapCommandParser::try_parse(&message, state) {
            ParseMessageResult::Success(c) => command = Some(c),
            ParseMessageResult::Error(e) => response_messages.push(convert_to_message(e)),
            ParseMessageResult::DoesNotMatch => {}
        };
    }

    if command.is_none() {
        match WithdrawCommandParser::try_parse(&message, state) {
            ParseMessageResult::Success(c) => command = Some(c),
            ParseMessageResult::Error(e) => response_messages.push(convert_to_message(e)),
            ParseMessageResult::DoesNotMatch => {}
        };
    }

    if let Some(command) = command {
        response_messages.push(BotMessage {
            content: MessageContentInitial::Text(command.build_message_text().into()),
            message_id: Some(command.message_id()),
        });
        command.process(state);
    }

    let add_help_text = response_messages.is_empty();
    if add_help_text {
        let mut text = "This bot currently supports the following message formats:\n\n".to_string();
        text.push_str(QuoteCommandParser::help_text());
        text.push_str("\n\n");
        text.push_str(BalanceCommandParser::help_text());
        text.push_str("\n\n");
        text.push_str(SwapCommandParser::help_text());
        text.push_str("\n\n");
        text.push_str(WithdrawCommandParser::help_text());
        response_messages.push(convert_to_message(text));
    }

    build_response(response_messages, &state.data)
}

fn build_response(messages: Vec<BotMessage>, data: &Data) -> Response {
    Success(SuccessResult {
        bot_name: data.username.clone(),
        bot_display_name: data.display_name.clone(),
        messages,
    })
}

fn convert_to_message(text: String) -> BotMessage {
    BotMessage {
        content: MessageContentInitial::Text(text.into()),
        message_id: None,
    }
}

async fn verify_caller() -> Result<UserId, String> {
    match read_state(check_for_known_caller) {
        CheckForKnownCallerResult::KnownUser(u) => Ok(u),
        CheckForKnownCallerResult::Unknown(caller, local_user_index_canister_id) => {
            match local_user_index_canister_c2c_client::lookup_user(caller, local_user_index_canister_id).await {
                Ok(user) => {
                    mutate_state(|state| state.data.known_callers.insert(caller, true));
                    Ok(user.user_id)
                }
                Err(LookupUserError::UserNotFound) => {
                    mutate_state(|state| state.data.known_callers.insert(caller, false));
                    Err("User not found".to_string())
                }
                Err(LookupUserError::InternalError(_)) => Err("An error occurred. Please try again later".to_string()),
            }
        }
        CheckForKnownCallerResult::Blocked => panic!(),
    }
}

enum CheckForKnownCallerResult {
    Unknown(Principal, Principal), // Caller, LocalUserIndex
    KnownUser(UserId),
    Blocked,
}

fn check_for_known_caller(state: &RuntimeState) -> CheckForKnownCallerResult {
    let caller = state.env.caller();
    match state.data.known_callers.get(&caller).copied() {
        Some(true) => CheckForKnownCallerResult::KnownUser(caller.into()),
        Some(false) => CheckForKnownCallerResult::Blocked,
        None => CheckForKnownCallerResult::Unknown(caller, state.data.local_user_index_canister_id),
    }
}
