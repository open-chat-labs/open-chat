use crate::read_state;

pub fn caller_is_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_string())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not the notifications canister".to_string())
    }
}
