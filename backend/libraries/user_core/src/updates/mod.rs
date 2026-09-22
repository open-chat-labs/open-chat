//! The update endpoints shared by the User and MultiUser canisters, one function per endpoint.
//! `create_group` and `create_community` stay as modules, since they share only their `prepare`.

mod add_hot_group_exclusions;
mod archive_unarchive_chats;
mod c2c_set_user_suspended;
pub mod create_community;
pub mod create_group;
mod mute_notifications;
mod pin_chat_v2;
mod save_crypto_account;
mod set_community_indexes;
mod set_contact;
mod unpin_chat_v2;

pub use add_hot_group_exclusions::add_hot_group_exclusions;
pub use archive_unarchive_chats::archive_unarchive_chats;
pub use c2c_set_user_suspended::c2c_set_user_suspended;
pub use mute_notifications::toggle_mute_notifications;
pub use pin_chat_v2::pin_chat_v2;
pub use save_crypto_account::save_crypto_account;
pub use set_community_indexes::set_community_indexes;
pub use set_contact::set_contact;
pub use unpin_chat_v2::unpin_chat_v2;
