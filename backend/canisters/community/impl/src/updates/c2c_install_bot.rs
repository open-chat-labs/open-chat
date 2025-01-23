use crate::guards::caller_is_local_user_index;
use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::c2c_install_bot::{Response::*, *};
use types::BotGroupConfig;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_install_bot_impl(args, state))
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return Frozen;
    }

    let Some(member) = state.data.members.get_by_user_id(&args.caller) else {
        return NotAuthorized;
    };

    if member.suspended().value || !member.role().is_owner() {
        return NotAuthorized;
    }

    if !state.data.install_bot(
        member.user_id,
        args.bot_id,
        BotGroupConfig {
            permissions: args.granted_permissions,
        },
        state.env.now(),
    ) {
        return AlreadyAdded;
    }

    handle_activity_notification(state);
    Success
}
