use crate::model::participants::ChangeRoleResult;
use crate::updates::handle_activity_notification;
use crate::updates::transfer_ownership::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::transfer_ownership::*;
use ic_cdk_macros::update;
use types::{OwnershipTransferred, Role};

#[update]
#[trace]
fn transfer_ownership(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| transfer_ownership_impl(args, state))
}

fn transfer_ownership_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state
        .data
        .participants
        .change_role(caller, &args.new_owner, Role::Owner)
    {
        ChangeRoleResult::UserNotInGroup => UserNotInGroup,
        ChangeRoleResult::CallerNotInGroup => CallerNotInGroup,
        ChangeRoleResult::Unchanged => Success,
        ChangeRoleResult::Success(r) => {
            if let Some(prev_owner) = r.prev_owner_id {
                let event = OwnershipTransferred {
                    old_owner: prev_owner,
                    new_owner: args.new_owner,
                };

                runtime_state.data.owner_id = args.new_owner; 

                runtime_state
                    .data
                    .events
                    .push_event(ChatEventInternal::OwnershipTransferred(Box::new(event)), now);

                handle_activity_notification(runtime_state);
            }

            Success
        }
        _ => NotAuthorized,
    }
}
