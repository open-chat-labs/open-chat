use crate::bots::extract_access_context;
use crate::queries::chat_events::make_c2c_call_to_get_events;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_events::{Response::*, *};
use local_user_index_canister::chat_events::{EventsArgs, EventsContext, EventsResponse};
use types::{AuthToken, BotActionScope, BotInitiator, ChannelId, Chat, MessageIndex, UserId};

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events(args: Args) -> Response {
    let PrepareOk {
        bot_id,
        initiator,
        chat,
        thread,
    } = match mutate_state(|state| prepare(args.channel_id, args.auth_token, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match make_c2c_call_to_get_events(
        EventsArgs {
            context: match chat {
                Chat::Direct(user_id) => EventsContext::Direct((*user_id).into()),
                Chat::Group(chat_id) => EventsContext::Group(chat_id, thread),
                Chat::Channel(community_id, channel_id) => EventsContext::Channel(community_id, channel_id, thread),
            },
            args: args.events,
            latest_known_update: None,
        },
        bot_id.into(),
        bot_id,
        Some(initiator),
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
    bot_id: UserId,
    initiator: BotInitiator,
    chat: Chat,
    thread: Option<MessageIndex>,
}

fn prepare(channel_id: Option<ChannelId>, auth_token: AuthToken, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let context = extract_access_context(&auth_token, state).map_err(FailedAuthentication)?;

    let (chat, thread) = match context.scope {
        BotActionScope::Chat(scope) => (scope.chat, scope.thread),
        BotActionScope::Community(scope) => {
            if let Some(channel_id) = channel_id {
                (Chat::Channel(scope.community_id, channel_id), None)
            } else {
                return Err(InternalError("Channel not specified".to_string()));
            }
        }
    };

    Ok(PrepareOk {
        bot_id: context.bot_id,
        initiator: context.initiator,
        chat,
        thread,
    })
}
