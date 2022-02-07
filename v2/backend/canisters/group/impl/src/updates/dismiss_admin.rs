use crate::model::participants::ChangeRoleResult;
use crate::updates::dismiss_admin::Response::*;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::dismiss_admin::*;
use ic_cdk_macros::update;
use types::{ParticipantsDismissedAsAdmin, Role};

#[update]
#[trace]
fn dismiss_admin(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| dismiss_admin_impl(args, state))
}

fn dismiss_admin_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state
        .data
        .participants
        .change_role(caller, &args.user_id, Role::Participant)
    {
        ChangeRoleResult::UserNotInGroup => UserNotInGroup,
        ChangeRoleResult::CallerNotInGroup => CallerNotInGroup,
        ChangeRoleResult::Invalid => UserNotAdmin,
        ChangeRoleResult::Unchanged => Success,
        ChangeRoleResult::Success(r) => {
            let event = ParticipantsDismissedAsAdmin {
                user_ids: vec![args.user_id],
                dismissed_by: r.caller_id,
            };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::ParticipantsDismissedAsAdmin(Box::new(event)), now);

            handle_activity_notification(runtime_state);
            Success
        }
        _ => NotAuthorized,
    }
}
