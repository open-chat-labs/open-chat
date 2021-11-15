use crate::guards::caller_is_user_index;
use crate::model::participants::DismissSuperAdminResult;
use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_dismiss_super_admin::{Response::*, *};
use ic_cdk_macros::update;
use types::ParticipantDismissedAsSuperAdmin;

#[update(guard = "caller_is_user_index")]
#[trace]
fn c2c_dismiss_super_admin(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_dismiss_super_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_dismiss_super_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.participants.dismiss_super_admin(&args.user_id) {
        DismissSuperAdminResult::Success => {
            let event = ParticipantDismissedAsSuperAdmin { user_id: args.user_id };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::ParticipantDismissedAsSuperAdmin(Box::new(event)), now);

            handle_activity_notification(runtime_state);
            Success
        }
        DismissSuperAdminResult::NotInGroup => UserNotInGroup,
        DismissSuperAdminResult::NotSuperAdmin => Success,
    }
}
