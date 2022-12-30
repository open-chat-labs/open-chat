use crate::read_state;

pub fn caller_is_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_string())
    }
}

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user index canister".to_string())
    }
}

pub fn caller_is_push_service() -> Result<(), String> {
    if read_state(|state| state.is_caller_push_service()) {
        Ok(())
    } else {
        Err("Caller is not a push service".to_string())
    }
}
