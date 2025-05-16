use canister_api_macros::update;
use local_user_index_canister::bot_delete_channel::*;
use local_user_index_canister::bot_delete_channel_v2::Args as ArgsV2;
use oc_error_codes::OCErrorCode;
use types::{BotActionScope, BotInitiator};

use crate::{bots::extract_access_context, mutate_state, read_state};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_channel(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    let community_id = match context.scope {
        BotActionScope::Chat(details) => match details.chat {
            types::Chat::Channel(community_id, channel_id) => {
                if channel_id != args.channel_id {
                    return OCErrorCode::InvalidRequest
                        .with_message("Channel ID does not match access token")
                        .into();
                }
                community_id
            }
            _ => {
                return OCErrorCode::InvalidBotActionScope
                    .with_message("Must be community scope")
                    .into();
            }
        },
        BotActionScope::Community(details) => details.community_id,
    };

    community_canister_c2c_client::c2c_bot_delete_channel(
        community_id.into(),
        &community_canister::c2c_bot_delete_channel::Args {
            channel_id: args.channel_id,
            bot_id: context.bot_id,
            initiator: context.initiator,
        },
    )
    .await
    .into()
}

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_channel_v2(args: ArgsV2) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Response::Error(OCErrorCode::BotNotAuthenticated.into());
    };

    community_canister_c2c_client::c2c_bot_delete_channel(
        args.community_id.into(),
        &community_canister::c2c_bot_delete_channel::Args {
            channel_id: args.channel_id,
            bot_id,
            initiator: BotInitiator::Autonomous,
        },
    )
    .await
    .into()
}
