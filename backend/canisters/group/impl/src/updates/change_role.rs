use crate::model::participants::ChangeRoleResult;
use crate::updates::change_role::Response::*;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::change_role::*;
use ic_cdk_macros::update;
use types::{OwnershipTransferred, RoleChanged};

#[update]
#[trace]
fn change_role(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| change_role_impl(args, state))
}

fn change_role_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let event =
        match runtime_state
            .data
            .participants
            .change_role(caller, &args.user_id, args.new_role, &runtime_state.data.permissions)
        {
            ChangeRoleResult::Success(r) => match r.prev_owner_id {
                Some(old_owner) => {
                    let event = OwnershipTransferred {
                        old_owner,
                        new_owner: args.user_id,
                    };
                    ChatEventInternal::OwnershipTransferred(Box::new(event))
                }
                None => {
                    let event = RoleChanged {
                        user_ids: vec![args.user_id],
                        old_role: r.prev_role,
                        new_role: args.new_role,
                        changed_by: r.caller_id,
                    };
                    ChatEventInternal::RoleChanged(Box::new(event))
                }
            },
            ChangeRoleResult::NotAuthorized => return NotAuthorized,
            ChangeRoleResult::Invalid => return Invalid,
            ChangeRoleResult::UserNotInGroup => return UserNotInGroup,
            ChangeRoleResult::Unchanged => return Success,
            ChangeRoleResult::CallerNotInGroup => return CallerNotInGroup,
        };

    runtime_state.data.events.push_event(event, now);
    handle_activity_notification(runtime_state);
    Success
}
