use crate::state;
use bot_types::{
    access_token::BotCommandClaims,
    commands::{InternalError, Message, SuccessResult},
    MessageContent, TextContent,
};
use bot_utils::action;

pub async fn joke(bot: BotCommandClaims, access_token: &str) -> Result<SuccessResult, InternalError> {
    let text = state::read(|state| state.get_random_joke());
    let content = MessageContent::Text(TextContent { text });

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
