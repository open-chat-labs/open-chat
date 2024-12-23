use local_user_index_canister::execute_bot_command::{self, BotApiCallError};
use types::{
    bot_actions::{BotMessageAction, MessageContent},
    BotAction, BotCommandClaims, CanisterId, TextContent,
};

use crate::execute_command::{execute_bot_command, InternalError, Message, SuccessResult};

pub async fn greet(bot: BotCommandClaims, access_token: &str) -> Result<SuccessResult, InternalError> {
    let user_id = bot.initiator;
    let content = MessageContent::Text(TextContent {
        text: format!("hello @UserId({user_id})"),
    });

    let args = execute_bot_command::Args {
        action: BotAction::SendMessage(BotMessageAction {
            content: content.clone(),
            finalised: true,
        }),
        jwt: access_token.to_string(),
    };

    // Send the message to the OC chat but don't wait for the response
    send_message_to_oc_chat(bot.bot_api_gateway, args);

    Ok(SuccessResult {
        message: Some(Message {
            id: bot.message_id,
            content,
        }),
    })
}

fn send_message_to_oc_chat(bot_api_gateway: CanisterId, args: execute_bot_command::Args) {
    ic_cdk::spawn(call_oc_bot_action_inner(bot_api_gateway, args));

    async fn call_oc_bot_action_inner(bot_api_gateway: CanisterId, args: execute_bot_command::Args) {
        let result = match execute_bot_command(bot_api_gateway, &args).await {
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
