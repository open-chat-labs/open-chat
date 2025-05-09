use crate::{bots::extract_access_context, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::bot_delete_messages::*;
use oc_error_codes::OCErrorCode;
use types::Chat;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_messages(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    let Some(chat) = context.scope.chat(args.channel_id) else {
        return OCErrorCode::InvalidBotActionScope
            .with_message("Channel not specified")
            .into();
    };

    match chat {
        Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
            .with_message("Direct chats not supported")
            .into(),
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_delete_messages(
            community_id.into(),
            &community_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                message_ids: args.message_ids,
                thread: args.thread,
            },
        )
        .await
        .into(),
        Chat::Group(chat_id) => group_canister_c2c_client::c2c_bot_delete_messages(
            chat_id.into(),
            &group_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                message_ids: args.message_ids,
                thread: args.thread.or(context.scope.thread()),
            },
        )
        .await
        .into(),
    }
}
