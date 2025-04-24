use crate::{bots::extract_access_context, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::bot_subscribe_to_chat_events::*;
use oc_error_codes::OCErrorCode;
use types::{AuthToken, BotActionScope, Chat};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_subscribe_to_chat_events(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&AuthToken::ApiKey(args.api_key), state)) {
        Ok(context) => context,
        Err(error) => return Response::Error(OCErrorCode::InitiatorNotAuthorized.with_message(error)),
    };

    let BotActionScope::Chat(scope) = context.scope else {
        return Response::Error(OCErrorCode::InvalidBotActionScope.with_message("Must be chat scope"));
    };

    let api_key_secret = context.initiator.api_key_secret().unwrap().to_string();

    match scope.chat {
        Chat::Group(group_id) => group_canister_c2c_client::c2c_bot_subscribe_to_chat_events(
            group_id.into(),
            &group_canister::c2c_bot_subscribe_to_chat_events::Args {
                bot_id: context.bot_id,
                api_key_secret,
                event_types: args.event_types,
            },
        )
        .await
        .into(),
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_subscribe_to_chat_events(
            community_id.into(),
            &community_canister::c2c_bot_subscribe_to_chat_events::Args {
                bot_id: context.bot_id,
                api_key_secret,
                channel_id,
                event_types: args.event_types,
            },
        )
        .await
        .into(),
        Chat::Direct(_) => Response::Error(OCErrorCode::InvalidBotActionScope.with_message("Direct chats are not supported")),
    }
}
