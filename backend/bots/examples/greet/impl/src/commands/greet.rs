use bot_types::{
    access_token::BotCommandClaims,
    commands::{InternalError, Message, SuccessResult},
    MessageContent, TextContent,
};
use bot_utils::action;

pub async fn greet(bot: BotCommandClaims, access_token: &str) -> Result<SuccessResult, InternalError> {
    let user_id = bot.initiator;
    let content = MessageContent::Text(TextContent {
        text: format!("hello @UserId({user_id})"),
    });

    // Send the message to the OC chat but don't wait for the response
    action::send_message(bot.bot_api_gateway, content.clone(), access_token.to_string());

    Ok(SuccessResult {
        message: Some(Message {
            id: bot.message_id,
            content,
            finalised: true,
        }),
    })
}
