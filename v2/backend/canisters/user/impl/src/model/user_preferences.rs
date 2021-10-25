use candid::CandidType;
use serde::Deserialize;
use types::{NightMode, Timestamped};

#[derive(CandidType, Deserialize, Debug)]
pub struct UserPreferences {
    pub enter_key_sends: Timestamped<bool>,
    pub enable_animations: Timestamped<bool>,
    pub night_mode: Timestamped<NightMode>,
    pub large_emoji: Timestamped<bool>,
    pub use_system_emojis: Timestamped<bool>,
    pub generate_link_previews: Timestamped<bool>,
    pub notification_preferences: NotificationPreferences,
    pub language: Timestamped<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct NotificationPreferences {
    pub direct_chats: Timestamped<bool>,
    pub private_group_chats: Timestamped<bool>,
    pub public_group_chats: Timestamped<bool>,
    pub silent: Timestamped<bool>,
    pub vibrate: Timestamped<bool>,
}

impl Default for UserPreferences {
    fn default() -> UserPreferences {
        UserPreferences {
            enter_key_sends: Timestamped::new(false, 0),
            enable_animations: Timestamped::new(true, 0),
            night_mode: Timestamped::new(NightMode::Auto, 0),
            large_emoji: Timestamped::new(true, 0),
            use_system_emojis: Timestamped::new(false, 0),
            generate_link_previews: Timestamped::new(true, 0),
            notification_preferences: NotificationPreferences::default(),
            language: Timestamped::new("en-gb".to_owned(), 0),
        }
    }
}
impl Default for NotificationPreferences {
    fn default() -> NotificationPreferences {
        NotificationPreferences {
            direct_chats: Timestamped::new(true, 0),
            private_group_chats: Timestamped::new(true, 0),
            public_group_chats: Timestamped::new(false, 0),
            silent: Timestamped::new(false, 0),
            vibrate: Timestamped::new(true, 0),
        }
    }
}
