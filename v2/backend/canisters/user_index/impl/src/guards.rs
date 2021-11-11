use crate::RUNTIME_STATE;

pub fn caller_is_controller() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_owned())
    }
}
