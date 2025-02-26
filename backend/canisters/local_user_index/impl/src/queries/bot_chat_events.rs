use crate::queries::chat_events::make_c2c_call_to_get_events;
use crate::read_state;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_events::{Response::*, *};
use local_user_index_canister::chat_events::{EventsArgs, EventsContext, EventsResponse};
use types::Chat;

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_events(args_wrapper: Args) -> Response {
    let Some(bot_user_id) = read_state(|state| {
        let caller = state.env.caller();
        state.data.bots.get_by_caller(&caller).map(|b| b.bot_id)
    }) else {
        return FailedAuthentication("Caller is not a registered bot".to_string());
    };

    match make_c2c_call_to_get_events(
        EventsArgs {
            context: match args_wrapper.chat {
                Chat::Direct(user_id) => EventsContext::Direct((*user_id).into()),
                Chat::Group(chat_id) => EventsContext::Group(chat_id, args_wrapper.thread_root_message_index),
                Chat::Channel(community_id, channel_id) => {
                    EventsContext::Channel(community_id, channel_id, args_wrapper.thread_root_message_index)
                }
            },
            args: args_wrapper.events,
            latest_known_update: None,
        },
        bot_user_id.into(),
        bot_user_id,
    )
    .await
    {
        EventsResponse::Success(response) => Success(response),
        EventsResponse::NotFound => NotFound,
        EventsResponse::InternalError(error) => InternalError(error),
        EventsResponse::ReplicaNotUpToDate(_) => unreachable!(),
    }
}
