use crate::updates::make_admin::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::make_admin::*;
use ic_cdk_macros::update;
use types::Role;

#[update]
fn make_admin(args: Args) -> Response {
    RUNTIME_STATE.with(|state| make_admin_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn make_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        if caller_participant.role.can_make_admin() {
            match runtime_state.data.participants.get_by_user_id_mut(&args.user_id) {
                None => UserNotInGroup,
                Some(participant) => {
                    participant.role = Role::Admin;
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
