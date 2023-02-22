use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_user_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_controller()) {
        Ok(())
    } else {
        Err("Caller is not a user controller".to_string())
    }
}

pub fn caller_is_bucket() -> Result<(), String> {
    if read_state(|state| state.is_caller_bucket()) {
        Ok(())
    } else {
        Err("Caller is not a bucket canister".to_string())
    }
}
