use crate::updates::remove_admin::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::remove_admin::*;
use ic_cdk_macros::update;
use types::Role;

#[update]
fn remove_admin(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if caller_participant.role.can_remove_admin() {
            match runtime_state.data.participants.get_by_user_id_mut(&args.user_id) {
                None => UserNotInGroup,
                Some(participant) => {
                    participant.role = Role::Participant;
                    Success
                },
            }
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
