use crate::read_state;

pub fn caller_is_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the user_index".to_string())
    }
}

pub fn caller_is_local_user_index() -> Result<(), String> {
    if read_state(|state| state.is_caller_local_user_index()) {
        Ok(())
    } else {
        Err("Caller is not the local_user_index".to_string())
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

pub fn caller_is_bot_api_gateway() -> Result<(), String> {
    if read_state(|state| state.is_caller_bot_api_gateway()) {
        Ok(())
    } else {
        Err("Caller is not the BotAPI Gateway".to_string())
    }
}

pub fn caller_is_proposals_bot() -> Result<(), String> {
    if read_state(|state| state.is_caller_proposals_bot()) {
        Ok(())
    } else {
        Err("Caller is not the proposals_bot".to_string())
    }
}

pub fn caller_is_escrow_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_escrow_canister()) {
        Ok(())
    } else {
        Err("Caller is not the escrow canister".to_string())
    }
}

pub fn caller_is_video_call_operator() -> Result<(), String> {
    if read_state(|state| state.is_caller_video_call_operator()) {
        Ok(())
    } else {
        Err("Caller is not a video call operator".to_string())
    }
}
