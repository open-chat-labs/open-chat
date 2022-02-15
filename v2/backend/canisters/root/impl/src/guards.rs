use crate::read_state;

pub fn caller_is_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_owned())
    }
}
