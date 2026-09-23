use crate::read_state;

// The caller is the principal of one of the users hosted by this canister. Which user is resolved
// from the caller within the endpoint, via `RuntimeState::caller_user_index`.
pub fn caller_is_hosted_user() -> Result<(), String> {
    if read_state(|state| state.caller_user_index().is_some()) {
        Ok(())
    } else {
        Err("Caller is not one of this canister's users".to_owned())
    }
}

pub fn caller_is_hosted_user_or_local_user_index() -> Result<(), String> {
    if read_state(|state| state.caller_user_index().is_some() || state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not one of this canister's users or the local_user_index canister".to_owned())
    }
}

pub fn caller_is_local_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the local_user_index canister".to_owned())
    }
}

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index canister".to_owned())
    }
}

pub fn caller_is_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the group_index canister".to_owned())
    }
}

pub fn caller_is_video_call_operator() -> Result<(), String> {
    if read_state(|state| state.is_caller_video_call_operator()) {
        Ok(())
    } else {
        Err("Caller is not a video call operator".to_owned())
    }
}
