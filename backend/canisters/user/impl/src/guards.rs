use crate::read_state;

pub fn caller_is_owner() -> Result<(), String> {
    if read_state(|state| state.is_caller_owner()) {
        Ok(())
    } else {
        Err("Caller is not the canister owner".to_owned())
    }
}

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}

pub fn caller_is_callback_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_callback_canister()) {
        Ok(())
    } else {
        Err("Caller is not the callback canister".to_string())
    }
}

pub fn caller_is_transaction_notifier_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_transaction_notifier_canister()) {
        Ok(())
    } else {
        Err("Caller is not the transaction notifier canister".to_string())
    }
}
