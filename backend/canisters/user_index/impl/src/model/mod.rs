pub mod account_billing;
pub mod authority_reports;
pub mod bridged_user_deposits;
pub mod bridged_users;
pub mod chit_leaderboard;
pub mod community_event_batch;
pub mod diamond_membership_details;
pub mod external_achievements;
pub mod group_event_batch;
pub mod group_index_event_batch;
pub mod identity_event_batch;
pub mod local_user_index_event_batch;
pub mod local_user_index_map;
pub mod moderation;
pub mod multi_user_canister_map;
pub mod online_users_event_batch;
pub mod pending_payments_queue;
pub mod premium_items;
pub mod protected_actions;
pub mod registry_tokens;
pub mod reported_messages;
pub mod storage_index_event_batch;
pub mod streak_insurance_logs;
pub mod user;
pub mod user_map;

use std::collections::HashSet;
use types::MiniAppDefinition;
use url::Url;

pub const MAX_AVATAR_SIZE: usize = 250_000;
pub const MAX_DESCRIPTION_LEN: usize = 10_000;
pub const MAX_COMMANDS: usize = 100;
pub const MAX_MINI_APPS: usize = 100;

// The LocalUserIndexes no longer send bots their notifications as JSON
pub const JSON_DATA_ENCODING_NOT_SUPPORTED: &str = "JSON data encoding is not supported, use MsgPack or Candid";

/// The apps a bot's definition declares, which its MiniApp cards name: each has a name, unique within
/// the definition, and an image URL which is either absolute (http or https) or a path relative to the
/// bot's endpoint, eg. "app/chess.svg"
pub fn validate_mini_apps(mini_apps: &[MiniAppDefinition]) -> Result<(), String> {
    if mini_apps.len() > MAX_MINI_APPS {
        return Err(format!("too many mini apps, the most is {MAX_MINI_APPS}"));
    }
    let base = Url::parse("https://example.com/").unwrap();
    let mut names = HashSet::new();
    for app in mini_apps {
        if app.name.trim().is_empty() {
            return Err("mini app name is blank".to_string());
        }
        if app.name.chars().count() > MiniAppDefinition::MAX_NAME_CHARS {
            return Err(format!(
                "mini app name \"{}\" is longer than {} characters",
                app.name,
                MiniAppDefinition::MAX_NAME_CHARS
            ));
        }
        if !names.insert(app.name.as_str()) {
            return Err(format!("mini app name \"{}\" is used more than once", app.name));
        }
        if app.image_url.chars().count() > MiniAppDefinition::MAX_IMAGE_URL_CHARS {
            return Err(format!(
                "mini app \"{}\" image url is longer than {} characters",
                app.name,
                MiniAppDefinition::MAX_IMAGE_URL_CHARS
            ));
        }
        let absolute = Url::parse(&app.image_url).is_ok();
        let valid = match Url::options().base_url(Some(&base)).parse(&app.image_url) {
            Ok(url) => !absolute || matches!(url.scheme(), "http" | "https"),
            Err(_) => false,
        };
        if !valid {
            return Err(format!(
                "mini app \"{}\" image url must be an http(s) url or a path relative to the endpoint",
                app.name
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(name: &str, image_url: &str) -> MiniAppDefinition {
        MiniAppDefinition {
            name: name.to_string(),
            image_url: image_url.to_string(),
        }
    }

    #[test]
    fn apps_with_unique_names_and_http_or_relative_images_are_valid() {
        assert!(
            validate_mini_apps(&[
                app("chess", "app/chess.svg"),
                app("uno", "https://cdn.example.com/uno.png"),
                app("ludo", "http://cdn.example.com/ludo.png"),
                app("go", "/images/go.png"),
                app("draughts", "../draughts.png"),
                app(
                    &"x".repeat(MiniAppDefinition::MAX_NAME_CHARS),
                    &"y".repeat(MiniAppDefinition::MAX_IMAGE_URL_CHARS)
                ),
            ])
            .is_ok()
        );
        assert!(validate_mini_apps(&[]).is_ok());
    }

    #[test]
    fn at_most_100_apps() {
        let apps: Vec<_> = (0..=MAX_MINI_APPS).map(|i| app(&format!("app{i}"), "app.svg")).collect();
        assert!(validate_mini_apps(&apps).is_err());
        assert!(validate_mini_apps(&apps[..MAX_MINI_APPS]).is_ok());
    }

    #[test]
    fn names_are_non_blank_at_most_50_characters_and_unique() {
        for name in ["", "  ", &"x".repeat(MiniAppDefinition::MAX_NAME_CHARS + 1)] {
            assert!(validate_mini_apps(&[app(name, "app.svg")]).is_err(), "{name:?}");
        }
        assert!(validate_mini_apps(&[app("chess", "a.svg"), app("chess", "b.svg")]).is_err());
    }

    #[test]
    fn image_urls_are_at_most_500_characters_and_http_or_relative() {
        for url in [
            &"y".repeat(MiniAppDefinition::MAX_IMAGE_URL_CHARS + 1),
            "ftp://cdn.example.com/chess.png",
            "javascript:alert(1)",
            "data:image/png;base64,AAAA",
            "https://",
            "http://[::1",
        ] {
            assert!(validate_mini_apps(&[app("chess", url)]).is_err(), "{url}");
        }
    }
}
