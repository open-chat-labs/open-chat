use crate::model::participants::DismissAdminResult;
use crate::updates::handle_activity_notification;
use crate::updates::dismiss_admin::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::dismiss_admin::*;
use ic_cdk_macros::update;
use types::ParticipantsDismissedAsAdmin;

#[update]
#[trace]
fn dismiss_admin(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| dismiss_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn dismiss_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        let caller_user_id = caller_participant.user_id;
        if caller_user_id == args.user_id {
            CannotDismissSelf
        } else if caller_participant.role.can_dismiss_admin() {
            match runtime_state.data.participants.dismiss_admin(&args.user_id) {
                DismissAdminResult::Success => {
                    let event = ParticipantsDismissedAsAdmin {
                        user_ids: vec![args.user_id],
                        dismissed_by: caller_user_id,
                    };
                    runtime_state
                        .data
                        .events
                        .push_event(ChatEventInternal::ParticipantsDismissedAsAdmin(Box::new(event)), now);

                    handle_activity_notification(runtime_state);
                    Success
                }
                DismissAdminResult::UserNotInGroup => UserNotInGroup,
                DismissAdminResult::UserNotAdmin => UserNotAdmin,
            }
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
