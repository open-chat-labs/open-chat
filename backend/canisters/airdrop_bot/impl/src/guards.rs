use crate::read_state;

pub fn caller_is_admin() -> Result<(), String> {
    if read_state(|state| state.is_caller_admin()) {
        Ok(())
    } else {
        Err("Caller is not an admin".to_string())
    }
}

pub fn caller_is_online_users_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_online_users_canister()) {
        Ok(())
    } else {
        Err("Caller is not the OnlineUsers canister".to_string())
    }
}
