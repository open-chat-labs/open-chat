use crate::BlobReference;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

// Where a bridge bot relayed a message from: the platform, and the message's author there. Only
// the bridge bot for that platform can set it; the LocalUserIndex rejects any other bot
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum BridgedFrom {
    Discord(DiscordMessageContext),
    Telegram(TelegramMessageContext),
}

// The platforms bridged into OpenChat, each by its own bridge bot
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum BridgePlatform {
    Discord,
    Telegram,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DiscordMessageContext {
    pub author: DiscordUser,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DiscordUser {
    // The user's Discord snowflake id
    pub id: u64,
    // The webhook's name if a webhook posted the message
    pub username: String,
    // The user's nickname in the server, else their global display name
    pub display_name: Option<String>,
    // The hash of the user's global avatar, not their server one, which the CDN url is built from.
    // "a_" followed by 32 hex chars if animated
    pub avatar: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TelegramMessageContext {
    pub author: TelegramUser,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TelegramUser {
    // The sender's Telegram id. Negative if a chat sent the message, eg. a channel or a group's
    // anonymous admins
    pub id: i64,
    pub username: Option<String>,
    // The user's first and last names, or the title of the chat which sent the message
    pub display_name: String,
    // A copy in OpenChat's storage, since the urls of Telegram's own copies contain the bot's token
    pub avatar: Option<BlobReference>,
}

// Discord's own limits. Users' names are at most 32 characters, webhooks' at most 80
const MAX_DISCORD_NAME_LENGTH: usize = 80;
const DISCORD_AVATAR_HASH_LENGTH: usize = 32;
// Telegram's own limits. A first name and a last name are at most 64 characters each, and a
// chat's title at most 128
const MAX_TELEGRAM_USERNAME_LENGTH: usize = 32;
const MAX_TELEGRAM_DISPLAY_NAME_LENGTH: usize = 129;

impl BridgedFrom {
    pub fn platform(&self) -> BridgePlatform {
        match self {
            BridgedFrom::Discord(_) => BridgePlatform::Discord,
            BridgedFrom::Telegram(_) => BridgePlatform::Telegram,
        }
    }

    pub fn into_author_display_name(self) -> String {
        match self {
            BridgedFrom::Discord(d) => d.author.display_name.unwrap_or(d.author.username),
            BridgedFrom::Telegram(t) => t.author.display_name,
        }
    }

    // The author's name followed by the platform, eg. "Nelly (Discord)". Notifications don't show
    // the platform's badge, so this stops an author passing as an OpenChat user there
    pub fn into_notification_display_name(self) -> String {
        let platform = self.platform();
        format!("{} ({platform})", self.into_author_display_name())
    }

    pub fn validate(&self) -> Result<(), String> {
        match self {
            BridgedFrom::Discord(d) => d.author.validate(),
            BridgedFrom::Telegram(t) => t.author.validate(),
        }
    }
}

impl Display for BridgePlatform {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgePlatform::Discord => f.write_str("Discord"),
            BridgePlatform::Telegram => f.write_str("Telegram"),
        }
    }
}

impl DiscordUser {
    pub fn validate(&self) -> Result<(), String> {
        validate_name("Discord username", &self.username, MAX_DISCORD_NAME_LENGTH)?;
        if let Some(display_name) = &self.display_name {
            validate_name("Discord display name", display_name, MAX_DISCORD_NAME_LENGTH)?;
        }
        if let Some(avatar) = &self.avatar {
            let hash = avatar.strip_prefix("a_").unwrap_or(avatar);
            if hash.len() != DISCORD_AVATAR_HASH_LENGTH || !hash.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')) {
                return Err("Discord avatar must be an avatar hash".to_string());
            }
        }
        Ok(())
    }
}

impl TelegramUser {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(username) = &self.username {
            validate_name("Telegram username", username, MAX_TELEGRAM_USERNAME_LENGTH)?;
        }
        validate_name("Telegram display name", &self.display_name, MAX_TELEGRAM_DISPLAY_NAME_LENGTH)
    }
}

fn validate_name(field: &str, name: &str, max_length: usize) -> Result<(), String> {
    if name.is_empty() || name.chars().count() > max_length {
        Err(format!("{field} must be 1 to {max_length} characters"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn discord_user() -> DiscordUser {
        DiscordUser {
            id: 80351110224678912,
            username: "nelly".to_string(),
            display_name: Some("Nelly".to_string()),
            avatar: Some("8342729096ea3675442027381ff50dfe".to_string()),
        }
    }

    fn telegram_user() -> TelegramUser {
        TelegramUser {
            id: 123456789,
            username: Some("nelly".to_string()),
            display_name: "Nelly Smith".to_string(),
            avatar: Some(BlobReference {
                canister_id: Principal::from_text("rturd-qaaaa-aaaaf-aabaq-cai").unwrap(),
                blob_id: 1,
            }),
        }
    }

    #[test]
    fn valid_discord_user() {
        assert!(discord_user().validate().is_ok());
        assert!(
            DiscordUser {
                display_name: None,
                avatar: None,
                ..discord_user()
            }
            .validate()
            .is_ok()
        );
        assert!(
            DiscordUser {
                avatar: Some("a_8342729096ea3675442027381ff50dfe".to_string()),
                ..discord_user()
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn invalid_discord_names() {
        for user in [
            DiscordUser {
                username: String::new(),
                ..discord_user()
            },
            DiscordUser {
                username: "a".repeat(81),
                ..discord_user()
            },
            DiscordUser {
                display_name: Some(String::new()),
                ..discord_user()
            },
        ] {
            assert!(user.validate().is_err(), "{user:?}");
        }
    }

    #[test]
    fn invalid_discord_avatars() {
        for avatar in [
            "https://cdn.discordapp.com/avatars/1/2.png",
            "8342729096EA3675442027381FF50DFE",
            "a_",
            "8342729096ea3675442027381ff50df",
        ] {
            assert!(
                DiscordUser {
                    avatar: Some(avatar.to_string()),
                    ..discord_user()
                }
                .validate()
                .is_err(),
                "{avatar}"
            );
        }
    }

    #[test]
    fn valid_telegram_user() {
        assert!(telegram_user().validate().is_ok());
        // Sent by a channel
        assert!(
            TelegramUser {
                id: -1001234567890,
                username: None,
                avatar: None,
                ..telegram_user()
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn invalid_telegram_names() {
        for user in [
            TelegramUser {
                username: Some(String::new()),
                ..telegram_user()
            },
            TelegramUser {
                username: Some("a".repeat(33)),
                ..telegram_user()
            },
            TelegramUser {
                display_name: String::new(),
                ..telegram_user()
            },
            TelegramUser {
                display_name: "a".repeat(130),
                ..telegram_user()
            },
        ] {
            assert!(user.validate().is_err(), "{user:?}");
        }
    }

    #[test]
    fn author_display_names() {
        let discord = |display_name: Option<&str>| {
            BridgedFrom::Discord(DiscordMessageContext {
                author: DiscordUser {
                    display_name: display_name.map(|n| n.to_string()),
                    ..discord_user()
                },
            })
        };
        assert_eq!(discord(Some("Nelly")).into_author_display_name(), "Nelly");
        assert_eq!(discord(None).into_author_display_name(), "nelly");
        assert_eq!(
            BridgedFrom::Telegram(TelegramMessageContext { author: telegram_user() }).into_author_display_name(),
            "Nelly Smith"
        );
        assert_eq!(discord(Some("Nelly")).into_notification_display_name(), "Nelly (Discord)");
    }
}
