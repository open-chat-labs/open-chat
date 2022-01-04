use crate::model::participants::TransferOwnershipResult;
use crate::updates::handle_activity_notification;
use crate::updates::transfer_ownership::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::transfer_ownership::*;
use ic_cdk_macros::update;
use types::OwnershipTransferred;

#[update]
#[trace]
fn transfer_ownership(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| transfer_ownership_impl(args, state))
}

fn transfer_ownership_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();

    let caller_participant = match runtime_state.data.participants.get_by_principal(caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    let caller_id = caller_participant.user_id;

    match runtime_state
        .data
        .participants
        .transfer_ownership(&caller_id, &args.new_owner)
    {
        TransferOwnershipResult::Success(prev_owner) => {
            if let Some(prev_owner) = prev_owner {
                let event = OwnershipTransferred {
                    old_owner: prev_owner,
                    new_owner: args.new_owner,
                };
                runtime_state
                    .data
                    .events
                    .push_event(ChatEventInternal::OwnershipTransferred(Box::new(event)), now);

                handle_activity_notification(runtime_state);
            }
            Success
        }
        TransferOwnershipResult::CallerNotInGroup => CallerNotInGroup,
        TransferOwnershipResult::CallerNotOwner => NotAuthorized,
        TransferOwnershipResult::UserNotInGroup => UserNotInGroup,
        TransferOwnershipResult::UserAlreadySuperAdmin => UserAlreadySuperAdmin,
        TransferOwnershipResult::UserAlreadyOwner => Success,
    }
}
