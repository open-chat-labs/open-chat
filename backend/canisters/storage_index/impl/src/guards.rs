use crate::read_state;

pub fn caller_is_service_principal() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not a service principal".to_owned())
    }
}

pub fn caller_is_bucket() -> Result<(), String> {
    if read_state(|state| state.is_caller_bucket()) {
        Ok(())
    } else {
        Err("Caller is not a bucket canister".to_owned())
    }
}
