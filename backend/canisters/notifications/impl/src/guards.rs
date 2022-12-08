use crate::read_state;

pub fn caller_is_notifications_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_index()) {
        Ok(())
    } else {
        Err("Caller is not the notifications index canister".to_owned())
    }
}

pub fn caller_is_push_service() -> Result<(), String> {
    if read_state(|state| state.is_caller_push_service()) {
        Ok(())
    } else {
        Err("Caller is not a push service".to_owned())
    }
}
