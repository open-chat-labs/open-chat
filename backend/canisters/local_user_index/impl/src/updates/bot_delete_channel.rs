use canister_api_macros::update;
use local_user_index_canister::bot_delete_channel_v2::*;
use oc_error_codes::OCErrorCode;
use types::BotInitiator;

use crate::read_state;

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_channel_v2(args: Args) -> Response {
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
