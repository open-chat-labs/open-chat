use crate::read_state;

pub fn caller_is_openchat_user() -> Result<(), String> {
    if read_state(|state| state.is_caller_openchat_user()) {
        Ok(())
    } else {
        Err("Caller is not an OpenChat user".to_string())
    }
}

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_registry_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_registry_canister()) {
        Ok(())
    } else {
        Err("Caller is not the Registry canister".to_string())
    }
}

pub fn caller_is_local_user_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local user index canister".to_string())
    }
}

pub fn caller_is_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the group index canister".to_string())
    }
}

pub fn caller_is_platform_moderator() -> Result<(), String> {
    if read_state(|state| state.is_caller_platform_moderator()) {
        Ok(())
    } else {
        Err("Caller is not a platform moderator".to_string())
    }
}

pub fn caller_is_platform_operator() -> Result<(), String> {
    if read_state(|state| state.is_caller_platform_operator()) {
        Ok(())
    } else {
        Err("Caller is not a platform operator".to_string())
    }
}

pub fn caller_is_modclub() -> Result<(), String> {
    if read_state(|state| state.is_caller_modclub()) {
        Ok(())
    } else {
        Err("Caller is not modclub".to_string())
    }
}

pub fn caller_is_user_canister_or_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index_canister() || state.is_caller_user_canister()) {
        Ok(())
    } else {
        Err("Caller is not a user canister or the group index canister".to_string())
    }
}

pub fn caller_is_translations_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_translations_canister()) {
        Ok(())
    } else {
        Err("Caller is not the translations canister".to_string())
    }
}

pub fn caller_can_upload_wasm_chunks() -> Result<(), String> {
    if read_state(|state| state.can_caller_upload_wasm_chunks()) {
        Ok(())
    } else {
        Err("Caller is not permitted to upload wasm chunks".to_string())
    }
}
