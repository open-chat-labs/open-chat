//! The update endpoints shared by the User and MultiUser canisters, one function per endpoint.
//! Endpoints which share only part of their logic, or several functions, stay as modules.

mod add_hot_group_exclusions;
pub mod approve_transfer;
mod archive_unarchive_chats;
mod c2c_charge_user_account;
mod c2c_install_bot;
pub mod c2c_local_user_index;
mod c2c_notify_achievement;
mod c2c_pay_for_premium_item;
mod c2c_set_user_suspended;
mod c2c_uninstall_bot;
pub mod claim_daily_chit;
pub mod create_community;
pub mod create_group;
pub mod generate_btc_address;
pub mod generate_one_sec_address;
mod join_video_call;
mod mute_notifications;
mod pin_chat_v2;
pub mod report_message;
mod save_crypto_account;
mod set_community_indexes;
mod set_contact;
mod unpin_chat_v2;
mod update_bot;
pub mod update_btc_balance;
pub mod withdraw_btc;
pub mod withdraw_via_one_sec;

pub use add_hot_group_exclusions::add_hot_group_exclusions;
pub use archive_unarchive_chats::archive_unarchive_chats;
pub use c2c_charge_user_account::c2c_charge_user_account;
pub use c2c_install_bot::c2c_install_bot;
pub use c2c_notify_achievement::c2c_notify_achievement;
pub use c2c_pay_for_premium_item::c2c_pay_for_premium_item;
pub use c2c_set_user_suspended::c2c_set_user_suspended;
pub use c2c_uninstall_bot::c2c_uninstall_bot;
pub use join_video_call::{answered_dismissal, join_video_call};
pub use mute_notifications::toggle_mute_notifications;
pub use pin_chat_v2::pin_chat_v2;
pub use save_crypto_account::save_crypto_account;
pub use set_community_indexes::set_community_indexes;
pub use set_contact::set_contact;
pub use unpin_chat_v2::unpin_chat_v2;
pub use update_bot::update_bot;
