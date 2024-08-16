use crate::read_state;

pub fn caller_is_group_index_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index_canister()) {
        Ok(())
    } else {
        Err("Caller is not the group_index canister".to_owned())
    }
}

pub fn caller_is_local_group_or_community_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_group_canister() || state.is_caller_local_community_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local group or community canister".to_owned())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not a notifications canister".to_owned())
    }
}
