use crate::read_state;

pub fn caller_is_registry_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_registry_canister()) {
        Ok(())
    } else {
        Err("Caller is not the registry canister".to_string())
    }
}
