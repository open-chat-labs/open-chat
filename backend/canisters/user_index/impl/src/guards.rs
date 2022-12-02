use crate::read_state;

pub fn caller_is_controller() -> Result<(), String> {
    if read_state(|state| state.is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_owned())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not the notifications canister".to_owned())
    }
}

pub fn caller_is_sms_sender() -> Result<(), String> {
    if read_state(|state| state.is_caller_sms_service()) {
        Ok(())
    } else {
        Err("Caller is not the sms sender".to_owned())
    }
}

pub fn caller_is_online_users_aggregator_canister() -> Result<(), String> {
    if read_state(|state| state.is_caller_online_users_aggregator_canister()) {
        Ok(())
    } else {
        Err("Caller is not the online users aggregator canister".to_owned())
    }
}

pub fn caller_is_super_admin() -> Result<(), String> {
    if read_state(|state| state.is_caller_super_admin()) {
        Ok(())
    } else {
        Err("Caller is not a super admin".to_owned())
    }
}
