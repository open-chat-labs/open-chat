use crate::bots::extract_access_context_from_chat_context;
use crate::mini_app::{MINI_APP_TOKEN_VALIDITY, sign_token_until};
use crate::updates::bot_send_message::extract_message_access_context;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_mini_app_post_token::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{
    BotActionByCommandClaims, BotActionScope, BotChatContext, BotInitiator, CLAIM_TYPE_BOT_ACTION_BY_COMMAND,
    CLAIM_TYPE_MINI_APP_POST, Chat, MiniAppGame, MiniAppPostClaims, OCResult, TimestampMillis,
};

// A bot's permission to post one MiniApp card, which it passes to the MiniApp service, and the service
// to `send_mini_app_message`. The card's context is resolved as `bot_send_message` would resolve it,
// and its message id fixed, so posting the token twice posts one card. The id is a chat command's, or
// one the bot chose: a query can't pick one, as its randomness repeats within a round.
#[query(candid = true, msgpack = true)]
#[trace]
fn bot_mini_app_post_token(args: Args) -> Response {
    match mutate_state(|state| bot_mini_app_post_token_impl(args, state)) {
        Ok(token) => Success(token),
        Err(error) => Error(error),
    }
}

fn bot_mini_app_post_token_impl(args: Args, state: &mut RuntimeState) -> OCResult<String> {
    // A command's card can be posted for as long as the command could be answered, no longer
    let command_expiry = match &args.chat_context {
        BotChatContext::Command(jwt) => Some(command_token_expiry(jwt, state)?),
        BotChatContext::Autonomous(_) => None,
    };
    let context = extract_access_context_from_chat_context(args.chat_context, state)?;
    // Only a command in a chat carries the card's message id. A community command names its channel
    // and, like an autonomous card, needs an id from the bot.
    let fixed_by_command =
        matches!(context.initiator, BotInitiator::Command(_)) && matches!(context.scope, BotActionScope::Chat(_));
    if args.message_id.is_none() && !fixed_by_command {
        return Err(OCErrorCode::InvalidRequest
            .with_message("A bot chooses the message id of a card, unless a chat command's token fixes it"));
    }
    let context = extract_message_access_context(context, args.channel_id, args.thread, args.message_id, state)?;
    // The service posts through the LocalUserIndex which signed the token, so it must host the chat
    let hosted_here = match context.chat {
        Chat::Group(chat_id) => state.data.local_groups.contains(&chat_id),
        Chat::Channel(community_id, _) => state.data.local_communities.contains(&community_id),
        Chat::Direct(_) => return Err(OCErrorCode::InvalidRequest.with_message("Direct chats have no MiniApp cards")),
    };
    if !hosted_here {
        return Err(OCErrorCode::ChatNotFound.with_message("The chat isn't on this LocalUserIndex"));
    }
    let bot_endpoint = state
        .data
        .bots
        .get(&context.bot_id)
        .map(|bot| bot.endpoint.clone())
        .ok_or(OCErrorCode::BotNotFound)?;

    let claims = MiniAppPostClaims {
        bot: context.bot_id,
        bot_endpoint,
        bot_api_gateway: state.env.canister_id(),
        game: MiniAppGame {
            chat: context.chat,
            thread: context.thread,
            message_id: context.message_id,
        },
        initiator: context.initiator,
    };
    let expiry = (state.env.now() + MINI_APP_TOKEN_VALIDITY).min(command_expiry.unwrap_or(TimestampMillis::MAX));
    sign_token_until(CLAIM_TYPE_MINI_APP_POST, claims, expiry, state).map_err(|error| OCErrorCode::Unknown.with_message(error))
}

fn command_token_expiry(jwt: &str, state: &RuntimeState) -> OCResult<TimestampMillis> {
    jwt::verify_and_decode::<BotActionByCommandClaims>(
        jwt,
        state.data.oc_key_pair.public_key_pem(),
        CLAIM_TYPE_BOT_ACTION_BY_COMMAND,
    )
    .map(|claims| claims.exp_ms())
    .map_err(|_| OCErrorCode::BotNotAuthenticated.into())
}
