use crate::read_state;

pub fn caller_is_registry_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_registry_canister()) {
        Ok(())
    } else {
        Err("Caller is not the Registry canister".to_string())
    }
}

pub fn caller_is_push_service() -> Result<(), String> {
    if read_state(|state| state.is_caller_push_service()) {
        Ok(())
    } else {
        Err("Caller is not a push service".to_string())
    }
}
