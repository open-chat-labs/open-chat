use canister_api_macros::update;
use canister_client::generate_c2c_call;
use jwt::{verify_jwt, Claims};
use local_user_index_canister::execute_bot_command::*;
use types::c2c_handle_bot_action;
use types::BotCommandClaims;
use types::User;

use crate::read_state;
use crate::RuntimeState;

#[update(candid = true, msgpack = true)]
async fn execute_bot_command(args: Args) -> Response {
    let c2c_args = match read_state(|state| validate(args, state)) {
        Ok(c2c_args) => c2c_args,
        Err(message) => return Err(BotApiCallError::Invalid(message)),
    };

    match c2c_handle_bot_action(c2c_args.chat.canister_id(), &c2c_args).await {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(message)) => Err(BotApiCallError::CanisterError(message)),
        Err((code, message)) => Err(BotApiCallError::C2CError(code as i32, message)),
    }
}

fn validate(args: Args, state: &RuntimeState) -> Result<c2c_handle_bot_action::Args, String> {
    let Some(bot) = state.data.bots.get_by_caller(&state.env.caller()) else {
        return Err("Bot not found for caller".to_string());
    };

    let claims = verify_jwt::<Claims<BotCommandClaims>>(&args.jwt, state.data.oc_key_pair.public_key_pem())
        .map_err(|error| format!("Access token invalid: {error:?}"))?;

    let bot_command_claims = claims.custom();
    let calling_user = bot.user_id;
    let jwt_user = bot_command_claims.bot;

    if calling_user != jwt_user {
        return Err(format!("Caller ({calling_user}) doesn't match JWT ({jwt_user})"));
    }

    Ok(c2c_handle_bot_action::Args {
        bot: User {
            user_id: bot_command_claims.bot,
            username: bot.name.clone(),
        },
        initiator: bot_command_claims.initiator,
        chat: bot_command_claims.chat,
        thread_root_message_index: bot_command_claims.thread_root_message_index,
        message_id: bot_command_claims.message_id,
        action: args.action,
        command_text: bot_command_claims.command_text.clone(),
    })
}

generate_c2c_call!(c2c_handle_bot_action);
