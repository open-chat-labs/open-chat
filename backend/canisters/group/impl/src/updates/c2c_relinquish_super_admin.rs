use crate::activity_notifications::handle_activity_notification;
use crate::model::participants::DismissSuperAdminResult;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_relinquish_super_admin::{Response::*, *};
use types::ParticipantRelinquishesSuperAdmin;

#[update_msgpack]
#[trace]
fn c2c_relinquish_super_admin(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_relinquish_super_admin_impl(args, state))
}

fn c2c_relinquish_super_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    match runtime_state.data.participants.dismiss_super_admin(&user_id) {
        DismissSuperAdminResult::Success => {
            let event = ParticipantRelinquishesSuperAdmin { user_id };
            runtime_state.data.events.push_main_event(
                ChatEventInternal::ParticipantRelinquishesSuperAdmin(Box::new(event)),
                args.correlation_id,
                now,
            );

            handle_activity_notification(runtime_state);
            Success
        }
        DismissSuperAdminResult::NotInGroup => CallerNotInGroup,
        DismissSuperAdminResult::NotSuperAdmin => Success,
    }
}
