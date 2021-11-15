use crate::RUNTIME_STATE;

pub fn caller_is_user_index() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}
