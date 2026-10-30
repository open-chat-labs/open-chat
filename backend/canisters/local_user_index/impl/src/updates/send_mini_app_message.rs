use crate::bots::BotAccessContext;
use crate::guards::caller_is_mini_app_service;
use crate::updates::bot_send_message::bot_send_message_impl;
use crate::{RuntimeState, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::send_mini_app_message::*;
use oc_error_codes::OCErrorCode;
use types::{
    BotActionChatDetails, BotActionScope, BotMessageContent, CLAIM_TYPE_MINI_APP_POST, Chat, ContentValidationError,
    MiniAppGame, MiniAppPostClaims, OCResult,
};

// The MiniApp service posting a card as the bot whose post token it holds. Posting the same token again
// is refused by the chat, as the message id is taken, so the service can retry a post safely.
#[update(guard = "caller_is_mini_app_service", candid = true, msgpack = true)]
#[trace]
async fn send_mini_app_message(args: Args) -> Response {
    let (context, game) = match read_state(|state| access_context_from_post_token(&args.token, &args.content.app, state)) {
        Ok(context) => context,
        Err(error) => return Response::Error(error),
    };
    bot_send_message_impl(
        context,
        None,
        game.thread,
        Some(game.message_id),
        args.replies_to,
        BotMessageContent::MiniApp(args.content),
        args.block_level_markdown,
        true,
        Vec::new(),
        None,
    )
    .await
}

// The card names one of the bot's apps, from its definition, as the card shows that app's image
fn access_context_from_post_token(token: &str, app: &str, state: &RuntimeState) -> OCResult<(BotAccessContext, MiniAppGame)> {
    let claims =
        jwt::verify_and_decode::<MiniAppPostClaims>(token, state.data.oc_key_pair.public_key_pem(), CLAIM_TYPE_MINI_APP_POST)
            .map_err(|_| OCErrorCode::InvalidRequest.with_message("Invalid post token"))?;
    if claims.exp_ms() < state.env.now() {
        return Err(OCErrorCode::Expired.with_message("Post token expired"));
    }
    let claims = claims.into_custom();
    if claims.bot_api_gateway != state.env.canister_id() {
        return Err(
            OCErrorCode::InvalidRequest.with_message("A card is posted through the LocalUserIndex which issued its token")
        );
    }
    if matches!(claims.game.chat, Chat::Direct(_)) {
        return Err(OCErrorCode::InvalidRequest.with_message("Direct chats have no MiniApp cards"));
    }
    let bot = state.data.bots.get(&claims.bot).ok_or(OCErrorCode::BotNotFound)?;
    if !bot.mini_apps.iter().any(|a| a.name == app) {
        return Err(ContentValidationError::InvalidMiniApp(format!("The bot's definition has no app named \"{app}\"")).into());
    }
    let context = BotAccessContext {
        bot_id: claims.bot,
        bot_name: bot.name.clone(),
        initiator: claims.initiator,
        scope: BotActionScope::Chat(BotActionChatDetails {
            chat: claims.game.chat,
            thread: claims.game.thread,
            message_id: claims.game.message_id,
            user_message_id: None,
        }),
    };
    Ok((context, claims.game))
}
