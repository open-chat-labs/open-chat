use crate::read_state;

pub fn caller_is_owner() -> Result<(), String> {
    if read_state(|state| state.is_caller_owner()) {
        Ok(())
    } else {
        Err("Caller is not the canister owner".to_owned())
    }
}

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}

pub fn caller_is_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the group_index canister".to_owned())
    }
}

pub fn caller_is_known_group_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_known_group_canister()) {
        Ok(())
    } else {
        Err("Caller is not a known group canister".to_owned())
    }
}

pub fn caller_is_known_bot() -> Result<(), String> {
    if read_state(|state| state.is_caller_known_bot()) {
        Ok(())
    } else {
        Err("Caller is not a known bot".to_owned())
    }
}
