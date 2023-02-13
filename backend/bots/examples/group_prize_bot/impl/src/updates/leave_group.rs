use crate::guards::caller_is_admin;
use crate::mutate_state;
use canister_tracing_macros::trace;
use group_prize_bot::leave_group::{Response::*, *};
use ic_cdk_macros::update;
use tracing::error;
use types::CanisterId;

#[update(guard = "caller_is_admin")]
#[trace]
async fn leave_group(args: Args) -> Response {
    if !args.remove_only {
        if let Err(response) = call_leave_group(args.group).await {
            return response;
        }
    }

    mutate_state(|state| {
        state.data.groups.remove(&args.group);
    });

    Success
}

async fn call_leave_group(group: CanisterId) -> Result<(), Response> {
    let c2c_args = group_canister::c2c_leave_group::Args { correlation_id: 0 };

    match group_canister_c2c_client::c2c_leave_group(group, &c2c_args).await {
        Ok(result) => match result {
            group_canister::c2c_leave_group::Response::Success(_) => Ok(()),
            group_canister::c2c_leave_group::Response::CallerNotInGroup => Err(CallerNotInGroup),
            group_canister::c2c_leave_group::Response::OwnerCannotLeave => Err(OwnerCannotLeave),
            group_canister::c2c_leave_group::Response::UserSuspended => Err(UserSuspended),
            group_canister::c2c_leave_group::Response::ChatFrozen => Err(ChatFrozen),
        },
        Err(error) => {
            let error_message = format!("{error:?}");
            error!(?error_message, ?group, "Failed to leave group");
            Err(InternalError(error_message))
        }
    }
}
