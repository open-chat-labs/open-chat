use crate::model::participants::TransferOwnershipResult;
use crate::updates::handle_activity_notification;
use crate::updates::transfer_ownership::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::transfer_ownership::*;
use ic_cdk_macros::update;
use tracing::instrument;
use types::OwnershipTransferred;

#[update]
#[instrument(level = "trace")]
fn transfer_ownership(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| transfer_ownership_impl(args, state.borrow_mut().as_mut().unwrap()))
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
        TransferOwnershipResult::Success => {
            let event = OwnershipTransferred {
                old_owner: caller_id,
                new_owner: args.new_owner,
            };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::OwnershipTransferred(Box::new(event)), now);

            handle_activity_notification(runtime_state);
            Success
        }
        TransferOwnershipResult::CallerNotInGroup => CallerNotInGroup,
        TransferOwnershipResult::CallerNotOwner => NotAuthorized,
        TransferOwnershipResult::UserNotInGroup => UserNotInGroup,
        TransferOwnershipResult::UserAlreadyOwner => Success,
    }
}
