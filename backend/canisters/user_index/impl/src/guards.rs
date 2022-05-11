use crate::read_state;

pub fn caller_is_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_string())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not the notifications canister".to_string())
    }
}

pub fn caller_is_sms_sender() -> Result<(), String> {
    if read_state(|state| state.is_caller_sms_service()) {
        Ok(())
    } else {
        Err("Caller is not the sms sender".to_string())
    }
}

pub fn caller_is_online_users_aggregator_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_online_users_aggregator_canister()) {
        Ok(())
    } else {
        Err("Caller is not the online users aggregator canister".to_string())
    }
}

pub fn caller_is_user_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_user_canister()) {
        Ok(())
    } else {
        Err("Caller is not a user canister".to_string())
    }
}
