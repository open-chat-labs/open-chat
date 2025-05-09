use crate::bots::extract_access_context;
use crate::mutate_state;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_details::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::Chat;

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details(args: Args) -> Response {
    bot_chat_details_impl(args).await
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details_c2c(args: Args) -> Response {
    bot_chat_details_impl(args).await
}

async fn bot_chat_details_impl(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    let Some(chat) = context.scope.chat(args.channel_id) else {
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
