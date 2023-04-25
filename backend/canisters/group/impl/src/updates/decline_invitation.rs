use crate::{mutate_state, read_state, run_regular_jobs};
use canister_tracing_macros::trace;
use group_canister::decline_invitation::{Response::*, *};
use ic_cdk_macros::update;
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn decline_invitation(_args: Args) -> Response {
    run_regular_jobs();

    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) => mutate_state(|state| {
            let now = state.env.now();

            match state.data.invited_users.remove(&user.user_id, now) {
                true => Success,
                false => NotInvited,
            }
        }),
        Err(LookupUserError::UserNotFound) => NotAuthorized,
        Err(LookupUserError::InternalError(error)) => InternalError(error),
    }
}
