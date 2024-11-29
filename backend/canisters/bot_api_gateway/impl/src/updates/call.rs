use bot_api_gateway_canister::c2c_handle_bot_action;
use bot_api_gateway_canister::call::*;
use canister_client::generate_c2c_call;
use ic_cdk::update;
use jwt::{verify_jwt, Claims};
use types::BotCommandClaims;
use types::User;

use crate::read_state;

#[update]
async fn call(args: Args) -> Response {
    // TODO: Get the BOT details given the caller

    let c2c_args = match read_state(|state| validate(args, &state.data.public_key)) {
        Ok(c2c_args) => c2c_args,
        Err(message) => return Err(BotApiCallError::Invalid(message)),
    };

    match c2c_handle_bot_action(c2c_args.chat.canister_id(), &c2c_args).await {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(message)) => Err(BotApiCallError::CanisterError(message)),
        Err((code, message)) => Err(BotApiCallError::C2CError(code as i32, message)),
    }
}

fn validate(args: Args /*, bot_details: &BotDetails */, public_key: &str) -> Result<c2c_handle_bot_action::Args, String> {
    let claims = verify_jwt::<Claims<BotCommandClaims>>(&args.jwt, public_key)
        .map_err(|error| format!("Access token invalid: {error:?}"))?;

    let bot_command_claims = claims.custom();

    // TODO: Confirm the bot UserId in the claim matches the UserId of the bot from the BotDetails

    Ok(c2c_handle_bot_action::Args {
        bot: User {
            user_id: bot_command_claims.bot,
            username: "NoNameBot".to_string(), // TODO: From the BotDetails
        },
        commanded_by: Some(bot_command_claims.user_id),
        chat: bot_command_claims.chat,
        thread_root_message_index: bot_command_claims.thread_root_message_index,
        message_id: bot_command_claims.message_id,
        action: args.action,
        command_text: bot_command_claims.command_text.clone(),
    })
}

generate_c2c_call!(c2c_handle_bot_action);
