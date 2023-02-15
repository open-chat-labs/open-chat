use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not the governance principal".to_string())
    }
}

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user index canister".to_string())
    }
}

pub fn caller_is_push_service() -> Result<(), String> {
    if read_state(|state| state.is_caller_push_service()) {
        Ok(())
    } else {
        Err("Caller is not a push service".to_string())
    }
}
