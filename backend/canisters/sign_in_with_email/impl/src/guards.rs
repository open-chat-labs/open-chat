use crate::state;

pub fn caller_is_whitelisted() -> Result<(), String> {
    if state::read(|state| state.is_caller_whitelisted()) {
        Ok(())
    } else {
        Err("Caller is not whitelisted".to_string())
    }
}
