use crate::updates::handle_activity_notification;
use crate::updates::remove_admin::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use cycles_utils::check_cycles_balance;
use group_canister::remove_admin::*;
use ic_cdk_macros::update;
use types::{ParticipantsDismissedAsAdmin, Role};

#[update]
fn remove_admin(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| remove_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        let caller_user_id = caller_participant.user_id;
        if caller_participant.role.can_remove_admin() {
            match runtime_state.data.participants.get_by_user_id_mut(&args.user_id) {
                None => UserNotInGroup,
                Some(participant) => {
                    participant.role = Role::Participant;

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
            }
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
