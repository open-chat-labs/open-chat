use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_bot_subscribe_to_events::*;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{BotInitiator, BotPermissions, BotSubscriptions, OCResult};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_subscribe_to_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_bot_subscribe_to_events_impl(args, state)).into()
}

fn c2c_bot_subscribe_to_events_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let subscriptions = BotSubscriptions {
        community: HashSet::new(),
        chat: args.event_types,
    };

    if !state
        .data
        .is_bot_permitted(&args.bot_id, &BotInitiator::Autonomous, &BotPermissions::from(&subscriptions))
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    state
        .data
        .chat
        .events
        .subscribe_bot_to_events(args.bot_id, subscriptions.chat);

    Ok(())
}
