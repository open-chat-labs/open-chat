use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_bot_subscribe_to_events::*;
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, BotPermissions, BotSubscriptions, OCResult};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_subscribe_to_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_bot_subscribe_to_events_impl(args, state)).into()
}

fn c2c_bot_subscribe_to_events_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let subscriptions = BotSubscriptions {
        community: args.community_events,
        chat: args.chat_events,
    };

    if !state.data.is_bot_permitted(
        &args.bot_id,
        Some(args.channel_id),
        &BotInitiator::Autonomous,
        &BotPermissions::from(&subscriptions),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    channel.chat.events.subscribe_bot_to_events(args.bot_id, subscriptions.chat);

    Ok(())
}
