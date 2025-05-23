use crate::bots::{BotAccessContext, extract_access_context, extract_access_context_from_chat_context};
use crate::mutate_state;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_details::{Response::*, *};
use local_user_index_canister::bot_chat_details_v2::Args as ArgsV2;
use oc_error_codes::OCErrorCode;
use types::{ChannelId, Chat};

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    bot_chat_details_impl(context, args.channel_id).await
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details_c2c(args: Args) -> Response {
    bot_chat_details(args).await
}

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details_v2(args: ArgsV2) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    bot_chat_details_impl(context, None).await
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details_c2c_v2(args: ArgsV2) -> Response {
    bot_chat_details_v2(args).await
}

async fn bot_chat_details_impl(context: BotAccessContext, channel_id: Option<ChannelId>) -> Response {
    let Some(chat) = context.scope.chat(channel_id) else {
        return Error(OCErrorCode::InvalidBotActionScope.with_message("Channel not specified"));
    };

    match chat {
        Chat::Direct(_) => Error(OCErrorCode::InvalidBotActionScope.with_message("Direct chats not supported")),
        Chat::Group(chat_id) => {
            match group_canister_c2c_client::c2c_bot_group_details(
                chat_id.into(),
                &group_canister::c2c_bot_group_details::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                },
            )
            .await
            {
                Ok(response) => response.into(),
                Err(error) => Error(error.into()),
            }
        }
        Chat::Channel(community_id, channel_id) => {
            match community_canister_c2c_client::c2c_bot_channel_details(
                community_id.into(),
                &community_canister::c2c_bot_channel_details::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    channel_id,
                },
            )
            .await
            {
                Ok(response) => response.into(),
                Err(error) => Error(error.into()),
            }
        }
    }
}
