use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::add_bot::{Response::*, *};
use types::BotGroupConfig;

#[update(msgpack = true)]
#[trace]
fn add_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_bot_impl(args, state))
}

fn add_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
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

    if !state.data.add_bot(
        member.user_id(),
        args.bot_id,
        BotGroupConfig {
            permissions: args.granted_permissions,
        },
        state.env.now(),
    ) {
        return AlreadyAdded;
    }

    // TODO: Notify UserIndex

    handle_activity_notification(state);
    Success
}
