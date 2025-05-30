use crate::bots::extract_access_context_from_chat_context;
use crate::mutate_state;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_summary::*;
use oc_error_codes::OCErrorCode;
use types::Chat;

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_chat_summary_c2c(args: Args) -> Response {
    bot_chat_summary(args).await
}

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_summary(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return Response::Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    let chat = context.scope.chat(None).unwrap();

    match chat {
        Chat::Direct(chat_id) => match user_canister_c2c_client::c2c_bot_chat_summary(
            chat_id.into(),
            &user_canister::c2c_bot_chat_summary::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
            },
        )
        .await
        {
            Ok(response) => response.into(),
            Err(error) => Response::Error(error.into()),
        },
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
                Err(error) => Response::Error(error.into()),
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
                Err(error) => Response::Error(error.into()),
            }
        }
    }
}
