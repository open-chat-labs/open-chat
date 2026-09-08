use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use tracing::{error, info};
use user_index_canister::create_multi_user_canister::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn create_multi_user_canister(args: Args) -> Response {
    let local_user_index_canister_id = args.local_user_index_canister_id;

    if !read_state(|state| state.data.local_index_map.contains_key(&local_user_index_canister_id)) {
        return LocalUserIndexNotFound;
    }

    match local_user_index_canister_c2c_client::c2c_create_multi_user_canister(
        local_user_index_canister_id,
        &local_user_index_canister::c2c_create_multi_user_canister::Args {},
    )
    .await
    {
        Ok(local_user_index_canister::c2c_create_multi_user_canister::Response::Success(canister_id)) => {
            // The canister id -> LocalUserIndex mapping is recorded when the
            // `MultiUserCanisterCreated` event arrives, not here, so that it still lands if this
            // reply is dropped
            info!(%canister_id, %local_user_index_canister_id, "MultiUser canister created");
            Success(canister_id)
        }
        Ok(local_user_index_canister::c2c_create_multi_user_canister::Response::Error(error)) => {
            error!(?error, %local_user_index_canister_id, "Failed to create MultiUser canister");
            InternalError(format!("{error:?}"))
        }
        Err(error) => {
            error!(?error, %local_user_index_canister_id, "Failed to create MultiUser canister");
            InternalError(format!("{error:?}"))
        }
    }
}
