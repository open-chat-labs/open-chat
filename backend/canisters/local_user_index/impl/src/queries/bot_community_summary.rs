use crate::read_state;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_community_summary::*;
use oc_error_codes::OCErrorCode;
use types::BotInitiator;

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_community_summary_c2c(args: Args) -> Response {
    bot_community_summary(args).await
}

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_community_summary(args: Args) -> Response {
    let Some(bot_id) = read_state(|state| state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id)) else {
        return Response::Error(OCErrorCode::BotNotAuthenticated.into());
    };

    match community_canister_c2c_client::c2c_bot_community_summary(
        args.community_id.into(),
        &community_canister::c2c_bot_community_summary::Args {
            bot_id,
            initiator: BotInitiator::Autonomous,
        },
    )
    .await
    {
        Ok(response) => response.into(),
        Err(error) => Response::Error(error.into()),
    }
}
