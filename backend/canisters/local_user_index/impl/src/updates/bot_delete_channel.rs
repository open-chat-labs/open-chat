use canister_api_macros::update;
use local_user_index_canister::bot_delete_channel::*;
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, CanisterId};

use crate::read_state;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_channel(args: Args) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Response::Error(OCErrorCode::BotNotAuthenticated.into());
    };

    let canister_id = CanisterId::from(args.community_id);
    let c2c_args = community_canister::c2c_bot_delete_channel::Args {
        channel_id: args.channel_id,
        bot_id,
        initiator: BotInitiator::Autonomous,
    };
    top_up_and_retry_if_out_of_cycles(canister_id, || {
        community_canister_c2c_client::c2c_bot_delete_channel(canister_id, &c2c_args)
    })
    .await
    .into()
}
