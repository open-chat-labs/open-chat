use local_user_index_canister::execute_bot_command::{self, BotApiCallError};
use types::{
    bot_actions::{BotMessageAction, MessageContent},
    BotAction, BotCommandClaims, TextContent,
};

use crate::execute::{execute_bot_command, InternalError, Message, SuccessResult};

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

    match execute_bot_command(bot.bot_api_gateway, &args).await {
        Ok(Ok(_)) => Ok(SuccessResult {
            message: Some(Message {
                id: bot.message_id,
                content,
            }),
        }),
        Ok(Err(error)) => match error {
            BotApiCallError::C2CError(code, message) => Err(InternalError::C2CError(code, message)),
            BotApiCallError::CanisterError(canister_error) => Err(InternalError::CanisterError(canister_error)),
            BotApiCallError::Invalid(text) => Err(InternalError::Invalid(text)),
        },
        Err((code, message)) => Err(InternalError::C2CError(code as i32, message)),
    }
}
