use crate::model::user::PhoneStatus;
use crate::DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT;
use types::RegistrationFee;

pub mod add_super_admin;
pub mod c2c_mark_send_message_failed;
pub mod c2c_mark_users_online;
pub mod c2c_notify_low_balance;
pub mod c2c_set_avatar;
pub mod confirm_phone_number;
pub mod create_canister;
pub mod generate_registration_fee;
pub mod notify_registration_fee_paid;
pub mod notify_storage_upgrade_fee_paid;
pub mod register_user;
pub mod remove_sms_messages;
pub mod remove_super_admin;
pub mod resend_code;
pub mod set_username;
pub mod submit_phone_number;
pub mod upgrade_canister;
pub mod upgrade_user_canister_wasm;
pub mod wallet_receive;

fn storage_byte_limit_for_new_user(phone_status: &PhoneStatus, registration_fee: &Option<RegistrationFee>) -> u64 {
    if matches!(phone_status, PhoneStatus::Confirmed(_)) || registration_fee.is_some() {
        DEFAULT_OPEN_STORAGE_USER_BYTE_LIMIT
    } else {
        0
    }
}
