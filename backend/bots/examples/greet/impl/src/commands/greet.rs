use super::send_message_to_oc_chat;
use crate::execute_command::{InternalError, Message, SuccessResult};
use types::{bot_actions::MessageContent, BotCommandClaims, TextContent};

pub async fn greet(bot: BotCommandClaims, access_token: &str) -> Result<SuccessResult, InternalError> {
    let user_id = bot.initiator;
    let content = MessageContent::Text(TextContent {
        text: format!("hello @UserId({user_id})"),
    });

    // Send the message to the OC chat but don't wait for the response
    send_message_to_oc_chat(bot.bot_api_gateway, content.clone(), access_token.to_string());

    Ok(SuccessResult {
        message: Some(Message {
            id: bot.message_id,
            content,
            finalised: true,
        }),
    })
}
