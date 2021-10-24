use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct UserPreferences {
    pub enter_key_sends: bool,
    pub enable_animations: bool,
    pub night_mode: NightMode,
    pub large_emoji: bool,
    pub use_system_emojis: bool,
    pub generate_link_previews: bool,
    pub notification_preferences: NotificationPreferences,
    pub language: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct NotificationPreferences {
    pub direct_chats: bool,
    pub private_group_chats: bool,
    pub public_group_chats: bool,
    pub silent: bool,
    pub vibrate: bool,
}

#[derive(CandidType, Deserialize, Debug, Default)]
pub struct OptionalUserPreferences {
    pub enter_key_sends: Option<bool>,
    pub enable_animations: Option<bool>,
    pub night_mode: Option<NightMode>,
    pub large_emoji: Option<bool>,
    pub use_system_emojis: Option<bool>,
    pub generate_link_previews: Option<bool>,
    pub notification_preferences: Option<OptionalNotificationPreferences>,
    pub language: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Default)]
pub struct OptionalNotificationPreferences {
    pub direct_chats: Option<bool>,
    pub private_group_chats: Option<bool>,
    pub public_group_chats: Option<bool>,
    pub silent: Option<bool>,
    pub vibrate: Option<bool>,
}

#[derive(CandidType, Deserialize, Debug, Clone, Copy)]
pub enum NightMode {
    On,
    Off,
    Auto,
}
