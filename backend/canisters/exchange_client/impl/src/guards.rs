use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_whitelisted_trader() -> Result<(), String> {
    if read_state(|state| state.is_caller_whitelisted_trader()) {
        Ok(())
    } else {
        Err("Caller is not a whitelisted trader".to_string())
    }
}
