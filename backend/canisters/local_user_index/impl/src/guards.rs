use crate::read_state;

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index".to_string())
    }
}

pub fn caller_is_user_index_or_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index() || state.is_caller_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the UserIndex or GroupIndex".to_string())
    }
}

pub fn caller_is_group_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_group_index()) {
        Ok(())
    } else {
        Err("Caller is not the group_index".to_string())
    }
}

pub fn caller_is_notifications_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_index()) {
        Ok(())
    } else {
        Err("Caller is not the notifications_index".to_string())
    }
}

pub fn caller_is_local_user_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local user canister".to_string())
    }
}

pub fn caller_is_local_group_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_group_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local group canister".to_string())
    }
}

pub fn caller_is_local_community_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_community_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local community canister".to_string())
    }
}

pub fn caller_is_local_child_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_child_canister()) {
        Ok(())
    } else {
        Err("Caller is not a local user, group or community".to_string())
    }
}

pub fn caller_is_notification_pusher() -> Result<(), String> {
    if read_state(|state| state.is_caller_notification_pusher()) {
        Ok(())
    } else {
        Err("Caller is not a notification pusher".to_string())
    }
}

pub fn caller_is_openchat_user() -> Result<(), String> {
    if read_state(|state| state.is_caller_openchat_user()) {
        Ok(())
    } else {
        Err("Caller is not an OpenChat user".to_string())
    }
}

pub fn caller_is_platform_operator() -> Result<(), String> {
    if read_state(|state| state.is_caller_platform_operator()) {
        Ok(())
    } else {
        Err("Caller is not a platform operator".to_string())
    }
}
