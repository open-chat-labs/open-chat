use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// The Discord side of a message the Discord bridge bot relays from Discord. Only the Discord bridge
// bot can set it; any other bot that tries is rejected by the LocalUserIndex
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
    pub username: String,
    // The user's nickname in the server, else their global display name
    pub display_name: Option<String>,
    // The hash Discord builds the avatar's CDN url from, eg. "a_" followed by 32 hex chars if animated
    pub avatar: Option<String>,
}

// Discord's own limits
const MAX_NAME_LENGTH: usize = 32;
const AVATAR_HASH_LENGTH: usize = 32;

impl DiscordMessageContext {
    pub fn validate(&self) -> Result<(), String> {
        self.author.validate()
    }
}

impl DiscordUser {
    pub fn validate(&self) -> Result<(), String> {
        if self.username.is_empty() || self.username.chars().count() > MAX_NAME_LENGTH {
            return Err(format!("Discord username must be 1 to {MAX_NAME_LENGTH} characters"));
        }
        if let Some(display_name) = &self.display_name
            && (display_name.is_empty() || display_name.chars().count() > MAX_NAME_LENGTH)
        {
            return Err(format!("Discord display name must be 1 to {MAX_NAME_LENGTH} characters"));
        }
        if let Some(avatar) = &self.avatar {
            let hash = avatar.strip_prefix("a_").unwrap_or(avatar);
            if hash.len() != AVATAR_HASH_LENGTH || !hash.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')) {
                return Err("Discord avatar must be an avatar hash".to_string());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user() -> DiscordUser {
        DiscordUser {
            id: 80351110224678912,
            username: "nelly".to_string(),
            display_name: Some("Nelly".to_string()),
            avatar: Some("8342729096ea3675442027381ff50dfe".to_string()),
        }
    }

    #[test]
    fn valid_user() {
        assert!(user().validate().is_ok());
        assert!(
            DiscordUser {
                display_name: None,
                avatar: None,
                ..user()
            }
            .validate()
            .is_ok()
        );
        assert!(
            DiscordUser {
                avatar: Some("a_8342729096ea3675442027381ff50dfe".to_string()),
                ..user()
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn invalid_names() {
        assert!(
            DiscordUser {
                username: String::new(),
                ..user()
            }
            .validate()
            .is_err()
        );
        assert!(
            DiscordUser {
                username: "a".repeat(33),
                ..user()
            }
            .validate()
            .is_err()
        );
        assert!(
            DiscordUser {
                display_name: Some(String::new()),
                ..user()
            }
            .validate()
            .is_err()
        );
    }

    #[test]
    fn invalid_avatars() {
        for avatar in [
            "https://cdn.discordapp.com/avatars/1/2.png",
            "8342729096EA3675442027381FF50DFE",
            "a_",
            "8342729096ea3675442027381ff50df",
        ] {
            assert!(
                DiscordUser {
                    avatar: Some(avatar.to_string()),
                    ..user()
                }
                .validate()
                .is_err(),
                "{avatar}"
            );
        }
    }
}
