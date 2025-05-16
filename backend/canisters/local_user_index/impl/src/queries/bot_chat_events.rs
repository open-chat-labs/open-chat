use crate::bots::{BotAccessContext, extract_access_context, extract_access_context_from_chat_context};
use crate::mutate_state;
use crate::queries::chat_events::make_c2c_call_to_get_events;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_events::{Response::*, *};
use local_user_index_canister::bot_chat_events_v2::Args as ArgsV2;
use local_user_index_canister::chat_events::{EventsArgs, EventsContext, EventsResponse, EventsSelectionCriteria};
use oc_error_codes::OCErrorCode;
use types::{ChannelId, Chat};

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    bot_chat_events_impl(context, args.channel_id, args.events).await
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events_c2c(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    bot_chat_events_impl(context, args.channel_id, args.events).await
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events_v2(args: ArgsV2) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    bot_chat_events_impl(context, None, args.events).await
}

async fn bot_chat_events_impl(
    context: BotAccessContext,
    channel_id: Option<ChannelId>,
    events: EventsSelectionCriteria,
) -> Response {
    let Some(chat) = context.scope.chat(channel_id) else {
        return Error(OCErrorCode::InvalidBotActionScope.with_message("Channel not specified"));
    };

    match make_c2c_call_to_get_events(
        EventsArgs {
            context: match chat {
                Chat::Direct(user_id) => EventsContext::Direct((*user_id).into()),
                Chat::Group(chat_id) => EventsContext::Group(chat_id, context.scope.thread()),
                Chat::Channel(community_id, channel_id) => {
                    EventsContext::Channel(community_id, channel_id, context.scope.thread())
                }
            },
            args: events,
            latest_known_update: None,
        },
        context.bot_id.into(),
        context.bot_id,
        Some(context.initiator),
    )
    .await
    {
        EventsResponse::Success(response) => Success(response.into()),
        EventsResponse::Error(error) => Error(error),
    }
}
