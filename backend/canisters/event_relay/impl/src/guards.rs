use crate::read_state;

pub fn caller_can_push_events() -> Result<(), String> {
    if read_state(|state| state.can_caller_push_events()) {
        Ok(())
    } else {
        Err("Caller is not whitelisted to push events".to_string())
    }
}

pub fn caller_is_registry_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_registry_canister()) {
        Ok(())
    } else {
        Err("Caller is not the Registry canister".to_string())
    }
}
