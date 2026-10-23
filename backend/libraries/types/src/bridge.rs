use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

// An account on another platform, eg. Discord, whose messages a bridge bot relays into OpenChat.
// A relayed message holds only this. The account's profile is in the UserIndex's registry.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum BridgedUserId {
    Discord(u64),
    Telegram(i64),
    Twitch(u64),
}

// The profile of an account on another platform. The bridge bot sends its author's with each message
// it relays, and the UserIndex keeps the latest. Only the bridge bot for the platform can send them;
// the LocalUserIndex rejects any other bot.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum BridgedUser {
    Discord(DiscordUser),
    Telegram(TelegramUser),
    Twitch(TwitchUser),
}

// A bridged account's latest profile, from the UserIndex's registry
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BridgedUserSummary {
    pub user: BridgedUser,
    // The OpenChat user who has linked the account to themself, if any, so clients can show the
    // account's messages as theirs
    pub linked_user_id: Option<UserId>,
    // When the profile or the link last changed
    pub updated: TimestampMillis,
}

// The platforms bridged into OpenChat, each by its own bridge bot
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum BridgePlatform {
    Discord,
    Telegram,
    Twitch,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DiscordUser {
    // The user's Discord snowflake id
    pub id: u64,
    // The webhook's name if a webhook posted the message
    pub username: String,
    // The user's global display name. Not their nickname in a server, since this profile is shown
    // wherever they're bridged
    pub display_name: Option<String>,
    // The hash of the user's global avatar, not their server one, which the CDN url is built from.
    // "a_" followed by 32 hex chars if animated
    pub avatar: Option<String>,
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
    // Telegram's `file_unique_id` for the user's profile photo, which the Telegram bridge copies to
    // its own CDN, since the urls of Telegram's copies contain the bot's token. The website builds
    // the photo's url from it and the user's id, as it does for a Discord avatar from its hash. It's
    // the same whichever bot sees the photo, so a new photo has a new id, and a new url.
    pub photo_id: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TwitchUser {
    // The user's Twitch id
    pub id: u64,
    // The user's login, eg. "nelly", which their channel's url is built from
    pub login: String,
    // The name shown in chat, eg. "Nelly", or a localized name
    pub display_name: String,
    // The path of the user's profile image on Twitch's CDN, static-cdn.jtvnw.net, eg.
    // "jtv_user_pictures/<id>-profile_image-300x300.png". The website builds the image's url from
    // it, so a profile can't point at another host.
    pub profile_image: Option<String>,
}

// Discord's own limits. Users' names are at most 32 characters, webhooks' at most 80
const MAX_DISCORD_NAME_LENGTH: usize = 80;
const DISCORD_AVATAR_HASH_LENGTH: usize = 32;
// Telegram's own limits. A first name and a last name are at most 64 characters each, and a
// chat's title at most 128
const MAX_TELEGRAM_USERNAME_LENGTH: usize = 32;
const MAX_TELEGRAM_DISPLAY_NAME_LENGTH: usize = 129;
// Telegram's file ids are base64url, and a `file_unique_id` is short
const MAX_TELEGRAM_PHOTO_ID_LENGTH: usize = 64;
// Twitch's logins are at most 25 characters, of letters, digits and `_`, and in lowercase. Twitch
// doesn't publish a limit for display names, which can be localized, so this allows for long ones.
const MAX_TWITCH_LOGIN_LENGTH: usize = 25;
const MAX_TWITCH_DISPLAY_NAME_LENGTH: usize = 64;
// Twitch's profile image paths are short, eg. "jtv_user_pictures/" and a uuid
const MAX_TWITCH_PROFILE_IMAGE_LENGTH: usize = 128;

// The start of each subaccount of the UserIndex which holds the tips for an account no one has linked
const TIPS_SUBACCOUNT_PREFIX: &[u8; 7] = b"OC_TIPS";

impl BridgedUserId {
    // The subaccount of the UserIndex in which tips on the account's relayed messages are held
    // until someone links it, when they're paid to them, or else refunded. It's "OC_TIPS", then the
    // platform, then zeros, then the id (big-endian), so the website can build it too. It must
    // never change, or tips held under the old one would be lost.
    pub fn tips_subaccount(&self) -> [u8; 32] {
        let (platform, id) = match self {
            BridgedUserId::Discord(id) => (1, id.to_be_bytes()),
            BridgedUserId::Telegram(id) => (2, id.to_be_bytes()),
            BridgedUserId::Twitch(id) => (3, id.to_be_bytes()),
        };
        let mut subaccount = [0; 32];
        subaccount[..7].copy_from_slice(TIPS_SUBACCOUNT_PREFIX);
        subaccount[7] = platform;
        subaccount[24..].copy_from_slice(&id);
        subaccount
    }

    pub fn platform(&self) -> BridgePlatform {
        match self {
            BridgedUserId::Discord(_) => BridgePlatform::Discord,
            BridgedUserId::Telegram(_) => BridgePlatform::Telegram,
            BridgedUserId::Twitch(_) => BridgePlatform::Twitch,
        }
    }
}

impl BridgedUser {
    pub fn id(&self) -> BridgedUserId {
        match self {
            BridgedUser::Discord(u) => BridgedUserId::Discord(u.id),
            BridgedUser::Telegram(u) => BridgedUserId::Telegram(u.id),
            BridgedUser::Twitch(u) => BridgedUserId::Twitch(u.id),
        }
    }

    pub fn platform(&self) -> BridgePlatform {
        self.id().platform()
    }

    pub fn into_display_name(self) -> String {
        match self {
            BridgedUser::Discord(u) => u.display_name.unwrap_or(u.username),
            BridgedUser::Telegram(u) => u.display_name,
            BridgedUser::Twitch(u) => u.display_name,
        }
    }

    // The author's name followed by the platform, eg. "Nelly (Discord)". Notifications don't show
    // the platform's badge, so this stops an author passing as an OpenChat user there
    pub fn into_notification_display_name(self) -> String {
        let platform = self.platform();
        format!("{} ({platform})", self.into_display_name())
    }

    pub fn validate(&self) -> Result<(), String> {
        match self {
            BridgedUser::Discord(u) => u.validate(),
            BridgedUser::Telegram(u) => u.validate(),
            BridgedUser::Twitch(u) => u.validate(),
        }
    }
}

impl Display for BridgePlatform {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgePlatform::Discord => f.write_str("Discord"),
            BridgePlatform::Telegram => f.write_str("Telegram"),
            BridgePlatform::Twitch => f.write_str("Twitch"),
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
        validate_name("Telegram display name", &self.display_name, MAX_TELEGRAM_DISPLAY_NAME_LENGTH)?;
        if let Some(photo_id) = &self.photo_id
            && (photo_id.is_empty()
                || photo_id.len() > MAX_TELEGRAM_PHOTO_ID_LENGTH
                || !photo_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'))
        {
            return Err("Telegram photo id must be a file_unique_id".to_string());
        }
        Ok(())
    }
}

impl TwitchUser {
    pub fn validate(&self) -> Result<(), String> {
        if self.login.is_empty()
            || self.login.len() > MAX_TWITCH_LOGIN_LENGTH
            || !self.login.chars().all(|c| matches!(c, 'a'..='z' | '0'..='9' | '_'))
        {
            return Err(format!(
                "Twitch login must be 1 to {MAX_TWITCH_LOGIN_LENGTH} lowercase letters, digits or underscores"
            ));
        }
        validate_name("Twitch display name", &self.display_name, MAX_TWITCH_DISPLAY_NAME_LENGTH)?;
        if let Some(profile_image) = &self.profile_image
            && !is_twitch_profile_image(profile_image)
        {
            return Err("Twitch profile image must be a path on Twitch's CDN".to_string());
        }
        Ok(())
    }
}

// A relative path of letters, digits, `_`, `-` and `.`, in segments separated by `/`, so it can only
// name a file on Twitch's CDN once the website puts the CDN's url before it
fn is_twitch_profile_image(path: &str) -> bool {
    path.len() <= MAX_TWITCH_PROFILE_IMAGE_LENGTH
        && path.split('/').all(|segment| {
            !segment.is_empty()
                && segment.chars().any(|c| c != '.')
                && segment
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
        })
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

    #[test]
    fn tips_subaccounts_are_the_same_as_ever() {
        let mut expected = [0; 32];
        expected[..8].copy_from_slice(b"OC_TIPS\x02");
        expected[24..].copy_from_slice(&123456789i64.to_be_bytes());
        assert_eq!(BridgedUserId::Telegram(123456789).tips_subaccount(), expected);
    }

    #[test]
    fn tips_subaccounts_differ_by_platform_and_id() {
        let discord = BridgedUserId::Discord(80351110224678912).tips_subaccount();
        let telegram = BridgedUserId::Telegram(80351110224678912).tips_subaccount();
        let twitch = BridgedUserId::Twitch(80351110224678912).tips_subaccount();
        let another = BridgedUserId::Discord(80351110224678913).tips_subaccount();
        assert_ne!(discord, telegram);
        assert_ne!(discord, twitch);
        assert_ne!(telegram, twitch);
        assert_ne!(discord, another);
    }

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
            photo_id: Some("AQADtLwxG5a_QEZ-".to_string()),
        }
    }

    fn twitch_user() -> TwitchUser {
        TwitchUser {
            id: 141981764,
            login: "nelly_99".to_string(),
            display_name: "Nelly_99".to_string(),
            profile_image: Some("jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png".to_string()),
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
                photo_id: None,
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
    fn invalid_telegram_photo_ids() {
        for photo_id in ["", "a b", "https://t.me/i/userpic/320/nelly.jpg", &"a".repeat(65)] {
            let user = TelegramUser {
                photo_id: Some(photo_id.to_string()),
                ..telegram_user()
            };
            assert!(user.validate().is_err(), "{photo_id}");
        }
    }

    #[test]
    fn valid_twitch_user() {
        assert!(twitch_user().validate().is_ok());
        for user in [
            TwitchUser {
                profile_image: None,
                ..twitch_user()
            },
            // A localized display name
            TwitchUser {
                display_name: "ネリー".to_string(),
                ..twitch_user()
            },
            // As long a path as is allowed
            TwitchUser {
                profile_image: Some(format!("jtv_user_pictures/{}.png", "a".repeat(106))),
                ..twitch_user()
            },
            // An older account's image, and Twitch's default ones
            TwitchUser {
                profile_image: Some("jtv_user_pictures/a_seagull-profile_image-4d2d235688c7dc66-300x300.png".to_string()),
                ..twitch_user()
            },
            TwitchUser {
                profile_image: Some(
                    "user-default-pictures-uv/13e5fa74-defa-11e9-809c-784f43822e80-profile_image-300x300.png".to_string(),
                ),
                ..twitch_user()
            },
        ] {
            assert!(user.validate().is_ok(), "{user:?}");
        }
    }

    #[test]
    fn invalid_twitch_names() {
        for user in [
            TwitchUser {
                login: String::new(),
                ..twitch_user()
            },
            TwitchUser {
                login: "Nelly".to_string(),
                ..twitch_user()
            },
            TwitchUser {
                login: "nelly smith".to_string(),
                ..twitch_user()
            },
            TwitchUser {
                login: "a".repeat(26),
                ..twitch_user()
            },
            TwitchUser {
                display_name: String::new(),
                ..twitch_user()
            },
            TwitchUser {
                display_name: "a".repeat(65),
                ..twitch_user()
            },
        ] {
            assert!(user.validate().is_err(), "{user:?}");
        }
    }

    #[test]
    fn invalid_twitch_profile_images() {
        for profile_image in [
            "",
            "https://static-cdn.jtvnw.net/jtv_user_pictures/a-profile_image-300x300.png",
            "//evil.example.com/a.png",
            "/jtv_user_pictures/a.png",
            "jtv_user_pictures/../a.png",
            "jtv_user_pictures//a.png",
            "jtv_user_pictures/a.png?x=1",
            "jtv_user_pictures/a%2e.png",
            "./a.png",
            "jtv_user_pictures/.../a.png",
            "jtv_user_pictures/",
            &format!("jtv_user_pictures/{}.png", "a".repeat(107)),
        ] {
            let user = TwitchUser {
                profile_image: Some(profile_image.to_string()),
                ..twitch_user()
            };
            assert!(user.validate().is_err(), "{profile_image}");
        }
    }

    #[test]
    fn display_names() {
        let discord = |display_name: Option<&str>| {
            BridgedUser::Discord(DiscordUser {
                display_name: display_name.map(|n| n.to_string()),
                ..discord_user()
            })
        };
        assert_eq!(discord(Some("Nelly")).into_display_name(), "Nelly");
        assert_eq!(discord(None).into_display_name(), "nelly");
        assert_eq!(BridgedUser::Telegram(telegram_user()).into_display_name(), "Nelly Smith");
        assert_eq!(discord(Some("Nelly")).into_notification_display_name(), "Nelly (Discord)");
        assert_eq!(
            BridgedUser::Twitch(twitch_user()).into_notification_display_name(),
            "Nelly_99 (Twitch)"
        );
    }

    #[test]
    fn ids() {
        assert_eq!(
            BridgedUser::Discord(discord_user()).id(),
            BridgedUserId::Discord(80351110224678912)
        );
        assert_eq!(
            BridgedUser::Telegram(telegram_user()).id(),
            BridgedUserId::Telegram(123456789)
        );
        assert_eq!(BridgedUserId::Telegram(-1).platform(), BridgePlatform::Telegram);
        assert_eq!(BridgedUser::Twitch(twitch_user()).id(), BridgedUserId::Twitch(141981764));
        assert_eq!(BridgedUserId::Twitch(1).platform(), BridgePlatform::Twitch);
    }
}
