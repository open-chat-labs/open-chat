use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::c2c_install_bot::*;
use types::{OCResult, UserType};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_install_bot_impl(args, state)).into()
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != state.env.canister_id().into() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    if state.data.suspended.value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    let now = state.env.now();

    if !state.data.bots.add(args.bot_id, args.caller, args.granted_permissions, now) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    // If there isn't already a direct chat with the bot, create one now
    state
        .data
        .direct_chats
        .get_or_create(args.bot_id, UserType::BotV2, || state.env.rng().r#gen(), now);

    Ok(())
}
