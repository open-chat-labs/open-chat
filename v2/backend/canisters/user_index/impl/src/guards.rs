use crate::RUNTIME_STATE;

pub fn caller_is_controller() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_service_principal()) {
        Ok(())
    } else {
        Err("Caller is not the canister controller".to_owned())
    }
}

pub fn caller_is_notifications_canister() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_notifications_canister()) {
        Ok(())
    } else {
        Err("Caller is not the notifications canister".to_owned())
    }
}

pub fn caller_is_sms_sender() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_sms_service()) {
        Ok(())
    } else {
        Err("Caller is not the sms sender".to_owned())
    }
}

pub fn caller_is_online_users_aggregator_canister() -> Result<(), String> {
    if RUNTIME_STATE.with(|state| state.borrow().as_ref().unwrap().is_caller_online_users_aggregator_canister()) {
        Ok(())
    } else {
        Err("Caller is not the online users aggregator canister".to_owned())
    }
}
