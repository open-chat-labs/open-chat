use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::mark_local_group_index_full::{Response::*, *};
use ic_cdk::update;
use tracing::info;
use types::{CanisterId, ChatId};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn mark_local_group_index_full(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(|state| match state.data.local_index_map.get_mut(&args.canister_id) {
        Some(index) => {
            index.set_full(args.full);
            info!(%args.canister_id, "Local group index canister marked full");
            Success
        }
        None => LocalGroupIndexNotFound,
    })
}
