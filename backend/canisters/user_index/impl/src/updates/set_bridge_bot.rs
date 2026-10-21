use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{SetBridgeBot, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use tracing::info;
use user_index_canister::set_bridge_bot::*;

// Sets the bot that bridges a platform, eg. Discord, the only bot that can relay messages from it.
// Recorded here and fanned out to every LocalUserIndex over the event queue, so a new
// LocalUserIndex is seeded with it too
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_bridge_bot(args: Args) -> Response {
    mutate_state(|state| set_bridge_bot_impl(args, state))
}

fn set_bridge_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(bot_id) = args.bot_id {
        if state.data.users.get_bot(&bot_id).is_none() {
            return Response::Error(OCErrorCode::BotNotFound.into());
        }
        state.data.bridge_bots.insert(args.platform, bot_id);
    } else {
        state.data.bridge_bots.remove(&args.platform);
    }

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetBridgeBot(SetBridgeBot {
            platform: args.platform,
            bot_id: args.bot_id,
        }),
        None,
    );

    info!(platform = %args.platform, bot_id = ?args.bot_id, "Bridge bot set");
    Response::Success
}
