use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_remove_user::*;
use oc_error_codes::OCErrorCode;
use types::{Chat, UserId};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_remove_user(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, args.user_id, args.block).await
}

async fn call_chat_canister(context: BotAccessContext, user_id: UserId, block: bool) -> Response {
    match context.scope {
        types::BotActionScope::Chat(details) => match details.chat {
            Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_remove_user_from_channel(
                community_id.into(),
                &community_canister::c2c_bot_remove_user_from_channel::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    channel_id,
                    user_id,
                },
            )
            .await
            .into(),
            Chat::Group(chat_id) => group_canister_c2c_client::c2c_bot_remove_user(
                chat_id.into(),
                &group_canister::c2c_bot_remove_user::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    user_id,
                    block,
                },
            )
            .await
            .into(),
            Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
                .with_message("Direct chats not supported")
                .into(),
        },
        types::BotActionScope::Community(details) => community_canister_c2c_client::c2c_bot_remove_user(
            details.community_id.into(),
            &community_canister::c2c_bot_remove_user::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                user_id,
                block,
            },
        )
        .await
        .into(),
    }
}
