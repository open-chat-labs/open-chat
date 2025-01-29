use canister_api_macros::update;
use canister_client::generate_c2c_call;
use jwt::Claims;
use local_user_index_canister::execute_bot_action::*;
use rand::Rng;
use types::c2c_handle_bot_action;
use types::AccessTokenScope;
use types::BotActionByApiKeyClaims;
use types::BotActionByCommandClaims;
use types::BotActionChatDetails;
use types::BotActionCommunityDetails;
use types::BotActionScope;
use types::User;

use crate::mutate_state;
use crate::RuntimeState;

#[update(candid = true)]
async fn execute_bot_action(args: Args) -> Response {
    let c2c_args = match mutate_state(|state| validate(args, state)) {
        Ok(c2c_args) => c2c_args,
        Err(message) => return Err(BotApiCallError::Invalid(message)),
    };

    match c2c_handle_bot_action(c2c_args.chat_details.chat.canister_id(), &c2c_args).await {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(message)) => Err(BotApiCallError::CanisterError(message)),
        Err((code, message)) => Err(BotApiCallError::C2CError(code as i32, message)),
    }
}

fn validate(args: Args, state: &mut RuntimeState) -> Result<c2c_handle_bot_action::Args, String> {
    let Some(bot) = state.data.bots.get_by_caller(&state.env.caller()) else {
        return Err("Bot not found for caller".to_string());
    };

    let claims_str = jwt::verify(&args.jwt, state.data.oc_key_pair.public_key_pem())
        .map_err(|error| format!("Access token invalid: {error:?}"))?;

    let (exp_ms, scope, command, bot_id) = if let Ok(claims) =
        jwt::decode_from_json::<Claims<BotActionByCommandClaims>>(&claims_str)
    {
        let bot_action_claims = claims.custom();
        (
            claims.exp_ms(),
            bot_action_claims.scope.clone(),
            Some(bot_action_claims.command.clone()),
            bot_action_claims.bot,
        )
    } else if let Ok(claims) = jwt::decode_from_json::<Claims<BotActionByApiKeyClaims>>(&claims_str) {
        let bot_action_claims = claims.custom();
        let scope = match bot_action_claims.scope {
            AccessTokenScope::Chat(chat) => BotActionScope::Chat(BotActionChatDetails {
                chat,
                thread_root_message_index: None,
                message_id: state.env.rng().gen::<u64>().into(),
            }),
            AccessTokenScope::Community(community_id) => BotActionScope::Community(BotActionCommunityDetails { community_id }),
        };
        (claims.exp_ms(), scope, None, bot_action_claims.bot)
    } else {
        return Err("Access token invalid".to_string());
    };

    if exp_ms < state.env.now() {
        return Err("Access token expired".to_string());
    }

    let calling_user = bot.user_id;

    if calling_user != bot_id {
        return Err(format!("Caller ({calling_user}) doesn't match JWT ({bot_id})"));
    }

    let BotActionScope::Chat(chat_details) = scope else {
        return Err("Community scope actions not supported yet".to_string());
    };

    Ok(c2c_handle_bot_action::Args {
        bot: User {
            user_id: bot.user_id,
            username: bot.name.clone(),
        },
        action: args.action,
        command,
        chat_details,
    })
}

generate_c2c_call!(c2c_handle_bot_action);
