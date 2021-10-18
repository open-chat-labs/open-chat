use crate::updates::handle_activity_notification;
use crate::updates::make_admin::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::make_admin::*;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{ParticipantsPromotedToAdmin, Role};

#[update]
#[instrument(level = "trace")]
fn make_admin(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| make_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn make_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        if caller_participant.role.can_make_admin() {
            let caller_user_id = caller_participant.user_id;
            match runtime_state.data.participants.get_by_user_id_mut(&args.user_id) {
                None => UserNotInGroup,
                Some(participant) => {
                    if !matches!(participant.role, Role::Admin) {
                        participant.role = Role::Admin;
                        runtime_state.data.accumulated_metrics.admins += 1;

                        let event = ParticipantsPromotedToAdmin {
                            user_ids: vec![args.user_id],
                            promoted_by: caller_user_id,
                        };
                        runtime_state
                            .data
                            .events
                            .push_event(ChatEventInternal::ParticipantsPromotedToAdmin(Box::new(event)), now);

                        handle_activity_notification(runtime_state);
                    }
                    Success
                }
            }
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
