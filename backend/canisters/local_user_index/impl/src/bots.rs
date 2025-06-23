use crate::RuntimeState;
use jwt::Claims;
use rand::Rng;
use types::{
    BotActionByCommandClaims, BotActionChatDetails, BotActionCommunityDetails, BotActionScope, BotChatContext, BotInitiator,
    BotInstallationLocation, BotLocationContext, Chat, MessageId, User, UserId,
};

pub struct BotAccessContext {
    pub bot_id: UserId,
    pub bot_name: String,
    pub initiator: BotInitiator,
    pub scope: BotActionScope,
}

pub fn extract_access_context_from_chat_context(
    chat_context: BotChatContext,
    state: &mut RuntimeState,
) -> Result<BotAccessContext, String> {
    let caller = state.env.caller();

    let Some(bot) = state.data.bots.get_by_caller(&caller) else {
        return Err("Caller is not a registered bot".to_string());
    };

    let user = User {
        user_id: bot.bot_id,
        username: bot.name.clone(),
    };

    match chat_context {
        BotChatContext::Command(jwt) => extract_access_context_from_jwt(&jwt, &user, state),
        BotChatContext::Autonomous(chat) => Ok(BotAccessContext {
            bot_id: user.user_id,
            bot_name: user.username,
            initiator: BotInitiator::Autonomous,
            scope: BotActionScope::Chat(BotActionChatDetails {
                chat,
                thread: None,
                message_id: state.env.rng().r#gen::<u64>().into(),
                user_message_id: None,
            }),
        }),
    }
}

pub fn extract_access_context_from_location_context(
    location_context: BotLocationContext,
    state: &mut RuntimeState,
) -> Result<BotAccessContext, String> {
    let caller = state.env.caller();

    let Some(bot) = state.data.bots.get_by_caller(&caller) else {
        return Err("Caller is not a registered bot".to_string());
    };

    let user = User {
        user_id: bot.bot_id,
        username: bot.name.clone(),
    };

    let scope = match location_context {
        BotLocationContext::Command(jwt) => return extract_access_context_from_jwt(&jwt, &user, state),
        BotLocationContext::Autonomous(BotInstallationLocation::Community(community_id)) => {
            BotActionScope::Community(BotActionCommunityDetails { community_id })
        }
        BotLocationContext::Autonomous(BotInstallationLocation::Group(chat_id)) => BotActionScope::Chat(BotActionChatDetails {
            chat: Chat::Group(chat_id),
            thread: None,
            message_id: MessageId::from(0_u64),
            user_message_id: None,
        }),
        BotLocationContext::Autonomous(BotInstallationLocation::User(chat_id)) => BotActionScope::Chat(BotActionChatDetails {
            chat: Chat::Direct(chat_id),
            thread: None,
            message_id: MessageId::from(0_u64),
            user_message_id: None,
        }),
    };

    Ok(BotAccessContext {
        bot_id: user.user_id,
        bot_name: user.username,
        initiator: BotInitiator::Autonomous,
        scope,
    })
}

fn extract_access_context_from_jwt(jwt: &str, bot: &User, state: &mut RuntimeState) -> Result<BotAccessContext, String> {
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
