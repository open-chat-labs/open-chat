use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_group_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_canister()) {
        Ok(())
    } else {
        Err("Caller is not a group canister".to_string())
    }
}

pub fn caller_is_community_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_community_canister()) {
        Ok(())
    } else {
        Err("Caller is not a community canister".to_string())
    }
}
