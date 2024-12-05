use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::remove_bot::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn remove_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_bot_impl(args, state))
}

fn remove_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(member) = state.data.get_member(caller) else {
        return NotAuthorized;
    };

    if member.suspended().value || !member.role().is_owner() {
        return NotAuthorized;
    }

    state.data.remove_bot(member.user_id(), args.bot_id, state.env.now());

    handle_activity_notification(state);
    Success
}
