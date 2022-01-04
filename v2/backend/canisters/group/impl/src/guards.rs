use crate::read_state;

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}
