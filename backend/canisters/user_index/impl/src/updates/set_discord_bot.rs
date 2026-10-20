use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use oc_error_codes::OCErrorCode;
use tracing::info;
use user_index_canister::set_discord_bot::*;

// Sets the bot that bridges Discord servers, the only bot that can relay a message as its Discord
// author. Recorded here and fanned out to every LocalUserIndex over the event queue, so a new
// LocalUserIndex is seeded with it too
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_discord_bot(args: Args) -> Response {
    mutate_state(|state| set_discord_bot_impl(args, state))
}

fn set_discord_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(bot_id) = args.bot_id
        && state.data.users.get_bot(&bot_id).is_none()
    {
        return Response::Error(OCErrorCode::BotNotFound.into());
    }

    state.data.discord_bot_id = args.bot_id;

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetDiscordBot(args.bot_id), None);

    info!(bot_id = ?args.bot_id, "Discord bot set");
    Response::Success
}
