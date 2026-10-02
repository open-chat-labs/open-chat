use canister_api_macros::update;
use local_user_index_canister::bot_create_channel::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, CanisterId, UserId};

use crate::read_state;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_create_channel(args: Args) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Response::Error(OCErrorCode::BotNotAuthenticated.into());
    };

    bot_create_channel_impl(args, bot_id, BotInitiator::Autonomous).await
}

async fn bot_create_channel_impl(args: Args, bot_id: UserId, initiator: BotInitiator) -> Response {
    let canister_id = CanisterId::from(args.community_id);
    let c2c_args = community_canister::c2c_bot_create_channel::Args {
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
    };
    let response = top_up_and_retry_if_out_of_cycles(canister_id, || {
        community_canister_c2c_client::c2c_bot_create_channel(canister_id, &c2c_args)
    })
    .await;

    match response {
        Ok(response) => match response {
            community_canister::c2c_bot_create_channel::Response::Success(result) => Success(SuccessResult {
                channel_id: result.channel_id,
            }),
            community_canister::c2c_bot_create_channel::Response::Error(error) => Error(error),
        },
        Err(error) => Error(error.into()),
    }
}
