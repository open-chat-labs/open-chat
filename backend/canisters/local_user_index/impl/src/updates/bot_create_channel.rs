use canister_api_macros::update;
use local_user_index_canister::bot_create_channel::{Response::*, *};
use local_user_index_canister::bot_create_channel_v2::Args as ArgsV2;
use oc_error_codes::OCErrorCode;
use types::{BotActionScope, BotInitiator, UserId};

use crate::{bots::extract_access_context, mutate_state, read_state};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_create_channel(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    let BotActionScope::Community(details) = context.scope else {
        return Error(OCErrorCode::InvalidBotActionScope.with_message("Must be community scope"));
    };

    bot_create_channel_impl(
        ArgsV2 {
            community_id: details.community_id,
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            avatar: args.avatar,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            messages_visible_to_non_members: args.messages_visible_to_non_members,
            permissions: args.permissions,
            events_ttl: args.events_ttl,
            gate_config: args.gate_config,
            external_url: args.external_url,
        },
        context.bot_id,
        context.initiator,
    )
    .await
}

#[update(candid = true, json = true, msgpack = true)]
async fn bot_create_channel_v2(args: ArgsV2) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Error(OCErrorCode::BotNotAuthenticated.into());
    };

    bot_create_channel_impl(args, bot_id, BotInitiator::Autonomous).await
}

async fn bot_create_channel_impl(args: ArgsV2, bot_id: UserId, initiator: BotInitiator) -> Response {
    match community_canister_c2c_client::c2c_bot_create_channel(
        args.community_id.into(),
        &community_canister::c2c_bot_create_channel::Args {
            bot_id,
            initiator,
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            avatar: args.avatar,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            messages_visible_to_non_members: args.messages_visible_to_non_members,
            permissions: args.permissions,
            events_ttl: args.events_ttl,
            gate_config: args.gate_config,
            external_url: args.external_url,
        },
    )
    .await
    {
        Ok(response) => match response {
            community_canister::c2c_bot_create_channel::Response::Success(result) => Success(SuccessResult {
                channel_id: result.channel_id,
            }),
            community_canister::c2c_bot_create_channel::Response::Error(error) => Error(error),
        },
        Err(error) => Error(error.into()),
    }
}
