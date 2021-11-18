use crate::RUNTIME_STATE;

pub fn caller_is_push_service() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_push_service()) {
        Ok(())
    } else {
        Err("Caller is not a push service".to_owned())
    }
}
