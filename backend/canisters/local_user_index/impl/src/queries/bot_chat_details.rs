use crate::bots::extract_access_context;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_chat_details::{Response::*, *};
use types::{AuthToken, BotActionScope, BotInitiator, ChannelId, Chat, UserId};

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_chat_details(args: Args) -> Response {
    let PrepareOk { bot_id, initiator, chat } = match mutate_state(|state| prepare(args.channel_id, args.auth_token, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    match chat {
        Chat::Direct(_) => DirectChatUnsupported,
        Chat::Group(chat_id) => {
            match group_canister_c2c_client::c2c_bot_group_details(
                chat_id.into(),
                &group_canister::c2c_bot_group_details::Args { bot_id, initiator },
            )
            .await
            {
                Ok(response) => response.into(),
                Err((code, message)) => InternalError(format!("{:?}: {}", code, message)),
            }
        }
        Chat::Channel(community_id, channel_id) => {
            match community_canister_c2c_client::c2c_bot_channel_details(
                community_id.into(),
                &community_canister::c2c_bot_channel_details::Args {
                    bot_id,
                    initiator,
                    channel_id,
                },
            )
            .await
            {
                Ok(response) => response.into(),
                Err((code, message)) => InternalError(format!("{:?}: {}", code, message)),
            }
        }
    }
}

struct PrepareOk {
    bot_id: UserId,
    initiator: BotInitiator,
    chat: Chat,
}

fn prepare(channel_id: Option<ChannelId>, auth_token: AuthToken, state: &mut RuntimeState) -> Result<PrepareOk, Box<Response>> {
    let context = extract_access_context(&auth_token, state).map_err(FailedAuthentication)?;

    let chat = match context.scope {
        BotActionScope::Chat(scope) => scope.chat,
        BotActionScope::Community(scope) => {
            if let Some(channel_id) = channel_id {
                Chat::Channel(scope.community_id, channel_id)
            } else {
                return Err(Box::new(InternalError("Channel not specified".to_string())));
            }
        }
    };

    Ok(PrepareOk {
        bot_id: context.bot_id,
        initiator: context.initiator,
        chat,
    })
}
