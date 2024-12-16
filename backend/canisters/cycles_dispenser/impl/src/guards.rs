use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_authorized_to_add_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_authorized_to_add_canister()) {
        Ok(())
    } else {
        Err("Caller is not authorized to add a canister".to_string())
    }
}
