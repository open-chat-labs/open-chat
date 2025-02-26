use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_bot::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_bot_impl(args, state))
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return NotAuthorized;
    }

    if !state.data.bots.update(args.bot_id, args.granted_permissions, state.env.now()) {
        return NotFound;
    }

    Success
}
