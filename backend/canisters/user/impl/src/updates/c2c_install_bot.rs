use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use rand::Rng;
use types::c2c_install_bot::{Response::*, *};
use types::UserType;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_install_bot_impl(args, state))
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if args.caller != state.env.canister_id().into() {
        return NotAuthorized;
    };

    if state.data.suspended.value {
        return NotAuthorized;
    }

    let now = state.env.now();

    if !state.data.bots.add(args.bot_id, args.caller, args.granted_permissions, now) {
        return AlreadyAdded;
    }

    // If there isn't already a direct chat with the bot, create one now
    if state.data.direct_chats.get(&args.bot_id.into()).is_none() {
        state
            .data
            .direct_chats
            .create(args.bot_id, UserType::BotV2, state.env.rng().gen(), now);
    }

    Success
}
