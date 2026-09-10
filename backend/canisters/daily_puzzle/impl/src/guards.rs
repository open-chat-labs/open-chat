use crate::{read_state, registry};
use candid::Principal;
use oc_error_codes::{OCError, OCErrorCode};

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
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
