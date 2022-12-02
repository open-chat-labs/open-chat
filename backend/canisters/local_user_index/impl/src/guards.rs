use crate::read_state;

pub fn caller_is_user_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not the notifications canister".to_owned())
    }
}

pub fn caller_is_local_user_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local user canister".to_owned())
    }
}
