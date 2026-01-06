use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_change_role::*;
use oc_error_codes::OCErrorCode;
use types::{Chat, GroupRole, UserId};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_change_role(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return Response::Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    call_chat_canister(context, args.user_ids, args.new_role).await
}

async fn call_chat_canister(context: BotAccessContext, user_ids: Vec<UserId>, new_role: GroupRole) -> Response {
    let Some(chat) = context.scope.chat(None) else {
        return Response::Error(OCErrorCode::InvalidBotActionScope.with_message("Channel not specified"));
    };

    match chat {
        Chat::Direct(_) => Response::Error(OCErrorCode::InvalidBotActionScope.with_message("Direct chats not supported")),
        Chat::Channel(community_id, channel_id) => match community_canister_c2c_client::c2c_bot_change_channel_role(
            community_id.into(),
            &community_canister::c2c_bot_change_channel_role::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                user_ids,
                new_role,
            },
        )
        .await
        {
            Ok(response) => response.into(),
            Err(error) => Response::Error(error.into()),
        },
        Chat::Group(chat_id) => match group_canister_c2c_client::c2c_bot_change_role(
            chat_id.into(),
            &group_canister::c2c_bot_change_role::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                user_ids,
                new_role,
            },
        )
        .await
        {
            Ok(response) => response.into(),
            Err(error) => Response::Error(error.into()),
        },
    }
}
