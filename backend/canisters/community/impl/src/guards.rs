use crate::read_state;

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index".to_string())
    }
}

pub fn caller_is_user_index_or_local_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index() || state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index or the local_user_index".to_string())
    }
}

pub fn caller_is_group_index_or_local_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index() || state.is_caller_local_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the group_index or the local_group_index".to_string())
    }
}

pub fn caller_is_local_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the local_group_index".to_string())
    }
}
