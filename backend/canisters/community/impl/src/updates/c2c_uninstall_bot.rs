use crate::guards::caller_is_local_user_index;
use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::c2c_uninstall_bot::{Response::*, *};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_uninstall_bot_impl(args, state))
}

fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if args.caller != state.data.user_index_canister_id.into() {
        let Some(member) = state.data.members.get_by_user_id(&args.caller) else {
            return NotAuthorized;
        };

        if member.suspended().value || !member.role().is_owner() {
            return NotAuthorized;
        }
    }

    state.data.uninstall_bot(args.caller, args.bot_id, state.env.now());

    handle_activity_notification(state);
    Success
}
