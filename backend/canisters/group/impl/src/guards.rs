use crate::read_state;

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_string())
    }
}

pub fn caller_is_callback_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_callback_canister()) {
        Ok(())
    } else {
        Err("Caller is not the callback canister".to_string())
    }
}

pub fn group_is_public() -> Result<(), String> {
    if read_state(|state| state.data.is_public) {
        Ok(())
    } else {
        Err("Group is not public".to_string())
    }
}
