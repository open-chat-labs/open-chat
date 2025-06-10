use canister_api_macros::update;
use local_user_index_canister::bot_create_channel_v2::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, UserId};

use crate::read_state;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_create_channel_v2(args: Args) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Error(OCErrorCode::BotNotAuthenticated.into());
    };

    bot_create_channel_impl(args, bot_id, BotInitiator::Autonomous).await
}

async fn bot_create_channel_impl(args: Args, bot_id: UserId, initiator: BotInitiator) -> Response {
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
