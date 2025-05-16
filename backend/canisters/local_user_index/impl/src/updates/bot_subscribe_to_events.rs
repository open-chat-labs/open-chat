use crate::read_state;
use canister_api_macros::update;
use local_user_index_canister::bot_subscribe_to_events::*;
use oc_error_codes::OCErrorCode;
use types::Chat;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_subscribe_to_chat_events(args: Args) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Response::Error(OCErrorCode::BotNotAuthenticated.into());
    };

    match args.chat {
        Chat::Group(group_id) => group_canister_c2c_client::c2c_bot_subscribe_to_events(
            group_id.into(),
            &group_canister::c2c_bot_subscribe_to_events::Args {
                bot_id,
                event_types: args.chat_events,
            },
        )
        .await
        .into(),
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_subscribe_to_events(
            community_id.into(),
            &community_canister::c2c_bot_subscribe_to_events::Args {
                bot_id,
                channel_id,
                chat_events: args.chat_events,
                community_events: args.community_events,
            },
        )
        .await
        .into(),
        Chat::Direct(_) => Response::Error(OCErrorCode::InvalidBotActionScope.with_message("Direct chats are not supported")),
    }
}
