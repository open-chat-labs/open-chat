use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_user_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the UserIndex canister".to_string())
    }
}

pub fn caller_is_registry_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_registry_canister()) {
        Ok(())
    } else {
        Err("Caller is not the Registry canister".to_string())
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

pub fn caller_is_group_or_community_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_canister() || state.is_caller_community_canister()) {
        Ok(())
    } else {
        Err("Caller is not a group or community canister".to_string())
    }
}

pub fn caller_can_upload_wasm_chunks() -> Result<(), String> {
    if read_state(|state| state.can_caller_upload_wasm_chunks()) {
        Ok(())
    } else {
        Err("Caller is not permitted to upload wasm chunks".to_string())
    }
}
