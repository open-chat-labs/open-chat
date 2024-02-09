use crate::read_state;

pub fn caller_can_push_events() -> Result<(), String> {
    if read_state(|state| state.can_caller_push_events()) {
        Ok(())
    } else {
        Err("Caller is not whitelisted to push events".to_string())
    }
}
