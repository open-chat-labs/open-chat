use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not the governance principal".to_string())
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

pub fn caller_is_super_admin() -> Result<(), String> {
    if read_state(|state| state.is_caller_super_admin()) {
        Ok(())
    } else {
        Err("Caller is not a super admin".to_string())
    }
}
