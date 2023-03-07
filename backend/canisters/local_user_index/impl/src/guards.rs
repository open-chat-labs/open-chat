use crate::read_state;

pub fn caller_is_user_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_string())
    }
}

pub fn caller_is_local_user_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local user canister".to_string())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not a notifications canister".to_string())
    }
}

pub fn caller_is_openchat_user() -> Result<(), String> {
    if read_state(|state| state.is_caller_openchat_user()) {
        Ok(())
    } else {
        Err("Caller is not an OpenChat user".to_string())
    }
}
