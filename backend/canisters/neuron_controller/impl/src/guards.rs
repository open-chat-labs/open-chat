use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_is_proposals_bot() -> Result<(), String> {
    if read_state(|state| state.is_caller_proposals_bot()) {
        Ok(())
    } else {
        Err("Caller is not the proposals bot".to_string())
    }
}
