use crate::{read_state, registry};
use candid::Principal;
use oc_error_codes::{OCError, OCErrorCode};
use user_index_canister_c2c_client::lookup_user;

/// Platform operators are known only to the user index, so this is an async check rather than a
/// guard. The operator functions are all admin-page tools called a handful of times a day.
pub async fn verify_caller_is_platform_operator() -> Result<(), OCError> {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_operator => Ok(()),
        Ok(_) => Err(OCErrorCode::InitiatorNotAuthorized.into()),
        Err(error) => Err(OCErrorCode::C2CError.with_message(format!("{error:?}"))),
    }
}

/// Local user indexes are learnt from the registry, so an unknown caller triggers one refresh
/// (throttled) before being refused.
pub async fn verify_caller_is_local_user_index(caller: Principal) -> Result<(), OCError> {
    if read_state(|state| state.data.local_user_indexes.contains(&caller)) {
        return Ok(());
    }
    registry::refresh_local_user_indexes_if_stale().await;
    if read_state(|state| state.data.local_user_indexes.contains(&caller)) {
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
