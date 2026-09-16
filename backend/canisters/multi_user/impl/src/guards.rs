use crate::read_state;

// The caller owns one of the users held by this canister. Which user is resolved from the caller
// within the endpoint, via `RuntimeState::caller_user_index`.
pub fn caller_is_owner() -> Result<(), String> {
    if read_state(|state| state.caller_user_index().is_some()) {
        Ok(())
    } else {
        Err("Caller is not one of this canister's users".to_owned())
    }
}

pub fn caller_is_owner_or_local_user_index() -> Result<(), String> {
    if read_state(|state| state.caller_user_index().is_some() || state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not one of this canister's users or the local_user_index canister".to_owned())
    }
}

pub fn caller_is_local_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the local_user_index canister".to_owned())
    }
}
