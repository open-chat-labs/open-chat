use crate::read_state;

pub fn caller_is_governance_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_governance_principal()) {
        Ok(())
    } else {
        Err("Caller is not a governance principal".to_string())
    }
}

pub fn caller_can_upload_wasm_chunks() -> Result<(), String> {
    if read_state(|state| state.can_caller_upload_wasm_chunks()) {
        Ok(())
    } else {
        Err("Caller is not permitted to upload wasm chunks".to_string())
    }
}
