use crate::RUNTIME_STATE;

pub fn caller_is_owner() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_owner()) {
        Ok(())
    } else {
        Err("Caller is not the canister owner".to_owned())
    }
}
