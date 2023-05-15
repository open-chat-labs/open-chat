use crate::read_state;

pub fn caller_is_admin() -> Result<(), String> {
    if read_state(|state| state.is_caller_admin()) {
        Ok(())
    } else {
        Err("Caller is not an admin".to_string())
    }
}

pub fn caller_is_local_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the LocalUserIndex canister".to_string())
    }
}
