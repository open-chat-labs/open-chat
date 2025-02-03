use crate::RuntimeState;
use jwt::Claims;
use rand::Rng;
use types::{
    AccessTokenScope, BotActionByApiKeyClaims, BotActionByCommandClaims, BotActionChatDetails, BotActionCommunityDetails,
    BotActionScope, BotApiKeyToken, BotInitiator, User, UserId,
};
use utils::base64;

pub struct BotAccessContext {
    pub bot_id: UserId,
    pub bot_name: String,
    pub initiator: BotInitiator,
    pub scope: BotActionScope,
}

pub fn extract_access_context(access_token: &str, state: &mut RuntimeState) -> Result<BotAccessContext, String> {
    let caller = state.env.caller();

    let Some(bot) = state.data.bots.get_by_caller(&caller) else {
        return Err("Caller is not a registered bot".to_string());
    };

    let user = User {
        user_id: bot.user_id,
        username: bot.name.clone(),
    };

    try_extract_access_context_from_apikey(access_token, &user, state)
        .or_else(|_| try_extract_access_context_from_jwt(access_token, &user, state))
}

fn try_extract_access_context_from_apikey(
    access_token: &str,
    bot: &User,
    state: &mut RuntimeState,
) -> Result<BotAccessContext, String> {
    const INVALID_MESSAGE: &str = "Not a valid API key";

    let token: BotApiKeyToken = base64::to_value(access_token).map_err(|_| INVALID_MESSAGE.to_string())?;

    if token.bot_id != bot.user_id {
        return Err(INVALID_MESSAGE.to_string());
    }

    let scope = to_bot_action_scope(token.scope, state);

    Ok(BotAccessContext {
        bot_id: token.bot_id,
        bot_name: bot.username.clone(),
        initiator: BotInitiator::ApiKeySecret(token.secret),
        scope,
    })
}

fn try_extract_access_context_from_jwt(jwt: &str, bot: &User, state: &mut RuntimeState) -> Result<BotAccessContext, String> {
    const INVALID_MESSAGE: &str = "Not a valid access token JWT";

    let claims_str = jwt::verify(jwt, state.data.oc_key_pair.public_key_pem()).map_err(|_| INVALID_MESSAGE.to_string())?;

    let (exp_ms, scope, initiator, bot_id) =
        if let Ok(claims) = jwt::decode_from_json::<Claims<BotActionByCommandClaims>>(&claims_str) {
            let exp = claims.exp_ms();
            let bot_action_claims = claims.into_custom();
            (
                exp,
                bot_action_claims.scope,
                BotInitiator::Command(bot_action_claims.command),
                bot_action_claims.bot,
            )
        } else if let Ok(claims) = jwt::decode_from_json::<Claims<BotActionByApiKeyClaims>>(&claims_str) {
            let exp = claims.exp_ms();
            let bot_action_claims = claims.into_custom();
            let scope = to_bot_action_scope(bot_action_claims.scope, state);
            (
                exp,
                scope,
                BotInitiator::ApiKeyPermissions(bot_action_claims.granted_permissions),
                bot_action_claims.bot,
            )
        } else {
            return Err(INVALID_MESSAGE.to_string());
        };

    if exp_ms < state.env.now() {
        return Err("Access token expired".to_string());
    }

    if bot.user_id != bot_id {
        return Err(INVALID_MESSAGE.to_string());
    }

    Ok(BotAccessContext {
        bot_id,
        bot_name: bot.username.clone(),
        initiator,
        scope,
    })
}

fn to_bot_action_scope(scope: AccessTokenScope, state: &mut RuntimeState) -> BotActionScope {
    match scope {
        AccessTokenScope::Chat(chat) => BotActionScope::Chat(BotActionChatDetails {
            chat,
            thread_root_message_index: None,
            message_id: state.env.rng().gen::<u64>().into(),
        }),
        AccessTokenScope::Community(community_id) => BotActionScope::Community(BotActionCommunityDetails { community_id }),
    }
}
