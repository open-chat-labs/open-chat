use crate::model::participants::DismissSuperAdminResult;
use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_relinquish_super_admin::{Response::*, *};
use ic_cdk_macros::update;
use types::ParticipantRelinquishesSuperAdmin;

#[update]
#[trace]
fn c2c_relinquish_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_relinquish_super_admin_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_relinquish_super_admin_impl(runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    match runtime_state.data.participants.dismiss_super_admin(&user_id) {
        DismissSuperAdminResult::Success => {
            let event = ParticipantRelinquishesSuperAdmin { user_id };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::ParticipantRelinquishesSuperAdmin(Box::new(event)), now);

            handle_activity_notification(runtime_state);
            Success
        }
        DismissSuperAdminResult::NotInGroup => CallerNotInGroup,
        DismissSuperAdminResult::NotSuperAdmin => Success,
    }
}
