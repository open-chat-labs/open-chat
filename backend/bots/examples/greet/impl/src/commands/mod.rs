use crate::execute_command::InternalError;
use ic_cdk::api::call::CallResult;
use local_user_index_canister::execute_bot_command::BotApiCallError;
use local_user_index_canister::execute_bot_command::{self};
use types::bot_actions::{BotMessageAction, MessageContent};
use types::{BotAction, CanisterId};

pub mod greet;
pub mod joke;

pub fn send_message_to_oc_chat(bot_api_gateway: CanisterId, content: MessageContent, jwt: String) {
    let action = BotAction::SendMessage(BotMessageAction {
        content,
        finalised: true,
    });

    let args = execute_bot_command::Args { action, jwt };

    ic_cdk::spawn(call_oc_bot_action_inner(bot_api_gateway, args));

    async fn call_oc_bot_action_inner(bot_api_gateway: CanisterId, args: execute_bot_command::Args) {
        let response: CallResult<(execute_bot_command::Response,)> =
            ic_cdk::call(bot_api_gateway, "execute_bot_command", (&args,)).await;

        let result = match response.map(|r| r.0) {
            Ok(Ok(_)) => Ok(()),
            Ok(Err(error)) => match error {
                BotApiCallError::C2CError(code, message) => Err(InternalError::C2CError(code, message)),
                BotApiCallError::CanisterError(canister_error) => Err(InternalError::CanisterError(canister_error)),
                BotApiCallError::Invalid(text) => Err(InternalError::Invalid(text)),
            },
            Err((code, message)) => Err(InternalError::C2CError(code as i32, message)),
        };

        if let Some(error) = result.err() {
            ic_cdk::println!("Failed to call OC bot action: {:?}", error);
        }
    }
}
