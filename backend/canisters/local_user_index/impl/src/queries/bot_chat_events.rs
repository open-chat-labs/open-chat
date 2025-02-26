use crate::queries::chat_events::make_c2c_call_to_get_events;
use crate::{read_state, RuntimeState, INVALID_API_KEY_MESSAGE};
use candid::Principal;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_events::{Response::*, *};
use local_user_index_canister::chat_events::{EventsArgs, EventsContext, EventsResponse};
use types::{AccessTokenScope, BotApiKeyToken, ChannelId, Chat, UserId};
use utils::base64;

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events(args: Args) -> Response {
    let PrepareOk {
        caller,
        bot_user_id,
        chat,
        api_key_secret,
    } = match read_state(|state| prepare(args.channel_id, &args.api_key, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match make_c2c_call_to_get_events(
        EventsArgs {
            context: match chat {
                Chat::Direct(user_id) => EventsContext::Direct((*user_id).into()),
                Chat::Group(chat_id) => EventsContext::Group(chat_id, args.thread_root_message_index),
                Chat::Channel(community_id, channel_id) => {
                    EventsContext::Channel(community_id, channel_id, args.thread_root_message_index)
                }
            },
            args: args.events,
            latest_known_update: None,
        },
        caller,
        bot_user_id,
        Some(api_key_secret),
    )
    .await
    {
        EventsResponse::Success(response) => Success(response),
        EventsResponse::NotFound => NotFound,
        EventsResponse::InternalError(error) => InternalError(error),
        EventsResponse::ReplicaNotUpToDate(_) => unreachable!(),
    }
}

struct PrepareOk {
    caller: Principal,
    bot_user_id: UserId,
    chat: Chat,
    api_key_secret: String,
}

fn prepare(channel_id: Option<ChannelId>, api_key: &str, state: &RuntimeState) -> Result<PrepareOk, Response> {
    let caller = state.env.caller();
    let Some(bot) = state.data.bots.get_by_caller(&caller) else {
        return Err(FailedAuthentication("Bot not found".to_string()));
    };
    let Ok(token) = base64::to_value::<BotApiKeyToken>(api_key) else {
        return Err(FailedAuthentication(INVALID_API_KEY_MESSAGE.to_string()));
    };
    if token.bot_id != bot.bot_id {
        return Err(FailedAuthentication(INVALID_API_KEY_MESSAGE.to_string()));
    }
    let chat = match token.scope {
        AccessTokenScope::Chat(chat) => chat,
        AccessTokenScope::Community(community_id) => {
            if let Some(channel_id) = channel_id {
                Chat::Channel(community_id, channel_id)
            } else {
                return Err(InternalError("Channel not specified".to_string()));
            }
        }
    };

    Ok(PrepareOk {
        caller,
        bot_user_id: bot.bot_id,
        chat,
        api_key_secret: token.secret,
    })
}
