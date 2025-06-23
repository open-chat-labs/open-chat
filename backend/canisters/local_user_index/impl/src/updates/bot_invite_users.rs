use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state, read_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_invite_users::*;
use oc_error_codes::OCErrorCode;
use types::{Chat, UserId};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_invite_users(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, args.user_ids).await
}

async fn call_chat_canister(context: BotAccessContext, user_ids: Vec<UserId>) -> Response {
    let Some(chat) = context.scope.chat(None) else {
        return OCErrorCode::InvalidBotActionScope
            .with_message("Channel not specified")
            .into();
    };

    let users = read_state(|state| {
        user_ids
            .iter()
            .flat_map(|u| state.data.global_users.get_by_user_id(u))
            .map(|u| (u.user_id, u.principal))
            .collect()
    });

    match chat {
        Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
            .with_message("Direct chats not supported")
            .into(),
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_invite_users(
            community_id.into(),
            &community_canister::c2c_bot_invite_users::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                users,
            },
        )
        .await
        .into(),
        Chat::Group(chat_id) => group_canister_c2c_client::c2c_bot_invite_users(
            chat_id.into(),
            &group_canister::c2c_bot_invite_users::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                users,
            },
        )
        .await
        .into(),
    }
}
