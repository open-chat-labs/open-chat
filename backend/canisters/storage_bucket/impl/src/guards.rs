use crate::read_state;

pub fn caller_is_storage_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_storage_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the storage index canister".to_owned())
    }
}

pub fn caller_is_known_user() -> Result<(), String> {
    if read_state(|state| state.is_caller_known_user()) {
        Ok(())
    } else {
        Err("Caller not recognised as a user".to_owned())
    }
}
