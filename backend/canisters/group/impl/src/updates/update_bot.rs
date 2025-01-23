use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_bot::{Response::*, *};
use types::BotGroupConfig;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_bot_impl(args, state))
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();

    let Some(member) = state.data.get_member(caller) else {
        return NotAuthorized;
    };

    if member.suspended().value || !member.role().is_owner() {
        return NotAuthorized;
    }

    if !state.data.update_bot(
        member.user_id(),
        args.bot_id,
        BotGroupConfig {
            permissions: args.granted_permissions,
        },
        state.env.now(),
    ) {
        return NotFound;
    }

    handle_activity_notification(state);
    Success
}
