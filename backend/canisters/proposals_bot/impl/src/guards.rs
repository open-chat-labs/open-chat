use crate::read_state;

pub fn caller_is_service_owner() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_owner()) {
        Ok(())
    } else {
        Err("Caller is not the service owner".to_owned())
    }
}
