use crate::commands::quote::QuoteCommandParser;
use crate::commands::{CommandParser, ParseMessageResult};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use exchange_bot_canister::handle_direct_message::*;
use local_user_index_canister_c2c_client::LookupUserError;
use types::UserId;

#[update_msgpack]
#[trace]
async fn handle_direct_message(args: Args) -> Response {
    if let Err(message) = verify_caller().await {
        return read_state(|state| state.data.build_text_response(message, None));
    };

    mutate_state(|state| match QuoteCommandParser::try_parse(&args.content, state) {
        ParseMessageResult::Success(command) => {
            let message = command.build_message();
            let message_id = command.message_id();
            let response = state.data.build_response(message, Some(message_id));
            ic_cdk::spawn(command.process());
            response
        }
        ParseMessageResult::Error(response) => response,
        ParseMessageResult::DoesNotMatch => todo!(),
    })
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
