use crate::read_state;

pub fn caller_is_user_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_owned())
    }
}
