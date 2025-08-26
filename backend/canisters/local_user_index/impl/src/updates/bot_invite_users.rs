use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state, read_state,
    updates::{invite_users_to_channel::send_channel_invitation, invite_users_to_group::send_group_invitation},
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
        Chat::Channel(community_id, channel_id) => {
            if let Some((invited_users, community_name, channel_name)) =
                match community_canister_c2c_client::c2c_bot_invite_users(
                    community_id.into(),
                    &community_canister::c2c_bot_invite_users::Args {
                        bot_id: context.bot_id,
                        initiator: context.initiator,
                        channel_id,
                        users,
                    },
                )
                .await
                {
                    Ok(community_canister::c2c_bot_invite_users::Response::Failed(_)) => None,
                    Ok(community_canister::c2c_bot_invite_users::Response::Success(result)) => {
                        Some((result.invited_users, result.community_name, result.channel_name))
                    }
                    Ok(community_canister::c2c_bot_invite_users::Response::PartialSuccess(result)) => {
                        Some((result.invited_users, result.community_name, result.channel_name))
                    }
                    Ok(community_canister::c2c_bot_invite_users::Response::Error(error)) => return Response::Error(error),
                    Err(error) => return Err(error).into(),
                }
            {
                mutate_state(|state| {
                    send_channel_invitation(
                        context.bot_id,
                        community_id,
                        community_name,
                        channel_id,
                        channel_name,
                        invited_users,
                        state,
                    );
                });
            }

            Response::Success
        }
        Chat::Group(chat_id) => {
            match group_canister_c2c_client::c2c_bot_invite_users(
                chat_id.into(),
                &group_canister::c2c_bot_invite_users::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    users,
                },
            )
            .await
            {
                Ok(response) => match response {
                    group_canister::c2c_bot_invite_users::Response::Success(result) => mutate_state(|state| {
                        send_group_invitation(context.bot_id, chat_id, result.group_name, result.invited_users, state);
                        Response::Success
                    }),
                    group_canister::c2c_bot_invite_users::Response::Error(error) => Response::Error(error),
                },
                Err(error) => Err(error).into(),
            }
        }
    }
}
