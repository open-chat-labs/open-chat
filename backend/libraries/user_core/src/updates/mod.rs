//! The update endpoints shared by the User and MultiUser canisters, one function per endpoint.
//! `create_group`, `create_community` and `report_message` stay as modules, since they share only
//! part of the endpoint.

mod add_hot_group_exclusions;
mod archive_unarchive_chats;
mod c2c_charge_user_account;
mod c2c_install_bot;
mod c2c_notify_achievement;
mod c2c_pay_for_premium_item;
mod c2c_set_user_suspended;
mod c2c_uninstall_bot;
pub mod create_community;
pub mod create_group;
mod join_video_call;
mod mute_notifications;
mod pin_chat_v2;
pub mod report_message;
mod save_crypto_account;
mod set_community_indexes;
mod set_contact;
mod unpin_chat_v2;
mod update_bot;

pub use add_hot_group_exclusions::add_hot_group_exclusions;
pub use archive_unarchive_chats::archive_unarchive_chats;
pub use c2c_charge_user_account::c2c_charge_user_account;
pub use c2c_install_bot::c2c_install_bot;
pub use c2c_notify_achievement::c2c_notify_achievement;
pub use c2c_pay_for_premium_item::c2c_pay_for_premium_item;
pub use c2c_set_user_suspended::c2c_set_user_suspended;
pub use c2c_uninstall_bot::c2c_uninstall_bot;
pub use join_video_call::join_video_call;
pub use mute_notifications::toggle_mute_notifications;
pub use pin_chat_v2::pin_chat_v2;
pub use save_crypto_account::save_crypto_account;
pub use set_community_indexes::set_community_indexes;
pub use set_contact::set_contact;
pub use unpin_chat_v2::unpin_chat_v2;
pub use update_bot::update_bot;
