use oc_error_codes::{OCError, OCErrorCode};
use types::{FieldTooLongResult, FieldTooShortResult, GroupSubtype};

const MIN_USERNAME_LENGTH: u32 = 5;
const MAX_USERNAME_LENGTH: u32 = 20;
const MIN_DISPLAY_NAME_LENGTH: u32 = 3;
const MAX_DISPLAY_NAME_LENGTH: u32 = 25;
const MIN_GROUP_NAME_LENGTH: u32 = 3;
const MAX_GROUP_NAME_LENGTH: u32 = 40;
const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;
const MAX_GROUP_RULES_LENGTH: u32 = 1024;
const MIN_USER_GROUP_NAME_LENGTH: u32 = 3;
const MAX_USER_GROUP_NAME_LENGTH: u32 = 25;

const RESERVED_GROUP_NAMES: [&str; 8] = [
    "channel",
    "group",
    "admins",
    "moderators",
    "owners",
    "here",
    "everyone",
    "all",
];

pub enum UsernameValidationError {
    TooLong(FieldTooLongResult),
    TooShort(FieldTooShortResult),
    Invalid,
}

impl From<UsernameValidationError> for OCError {
    fn from(value: UsernameValidationError) -> Self {
        match value {
            UsernameValidationError::TooLong(f) => OCErrorCode::UsernameTooLong.with_json(&f),
            UsernameValidationError::TooShort(f) => OCErrorCode::UsernameTooShort.with_json(&f),
            UsernameValidationError::Invalid => OCErrorCode::InvalidUsername.into(),
        }
    }
}

pub fn validate_display_name(
    display_name: &str,
    blocked_display_name_patterns: &[String],
) -> Result<(), UsernameValidationError> {
    const FORBIDDEN_CHARS: [char; 10] = ['@', '<', '>', '/', '\\', '#', '"', '\'', '`', '💎'];
    match validate_string_length(display_name, MIN_DISPLAY_NAME_LENGTH, MAX_DISPLAY_NAME_LENGTH) {
        Ok(()) => {
            if display_name.starts_with(' ')
                || display_name.ends_with(' ')
                || display_name.contains(|c: char| c.is_ascii_whitespace() && c != ' ')
                || display_name.contains("  ")
                || (display_name.chars().any(|c| FORBIDDEN_CHARS.contains(&c)))
                || input_matches_any(&display_name.to_lowercase(), blocked_display_name_patterns)
            {
                Err(UsernameValidationError::Invalid)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(s)) => Err(UsernameValidationError::TooShort(s)),
        Err(StringLengthValidationError::TooLong(l)) => Err(UsernameValidationError::TooLong(l)),
    }
}

pub fn validate_username(username: &str, blocked_username_patterns: &[String]) -> Result<(), UsernameValidationError> {
    validate_username_custom(username, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH, blocked_username_patterns)
}

pub fn validate_username_custom(
    username: &str,
    min_length: u32,
    max_length: u32,
    blocked_username_patterns: &[String],
) -> Result<(), UsernameValidationError> {
    match validate_string_length(username, min_length, max_length) {
        Ok(()) => {
            if username.starts_with('_')
                || username.ends_with('_')
                || username.contains("__")
                || (username.chars().any(|c| !c.is_ascii_alphanumeric() && c != '_'))
                || is_username_reserved(username, blocked_username_patterns)
            {
                Err(UsernameValidationError::Invalid)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(s)) => Err(UsernameValidationError::TooShort(s)),
        Err(StringLengthValidationError::TooLong(l)) => Err(UsernameValidationError::TooLong(l)),
    }
}

fn is_username_reserved(username: &str, blocked_username_patterns: &[String]) -> bool {
    let username_lower = username.to_lowercase();
    let is_bot_like = username_lower.ends_with("bot") || username_lower.ends_with("b0t");

    if is_bot_like {
        if username_lower == "openchatbot" {
            return true;
        }
        if username_lower.starts_with("sns") {
            return true;
        }
    }

    input_matches_any(&username_lower, blocked_username_patterns)
}

fn input_matches_any(input: &str, patterns: &[String]) -> bool {
    for pattern in patterns {
        if regex_lite::Regex::new(pattern).is_ok_and(|r| r.is_match(input)) {
            return true;
        }
    }
    false
}

pub fn validate_community_name(name: &str, is_public: bool) -> Result<(), NameValidationError> {
    validate_group_name(name, is_public, None)
}

pub fn validate_channel_name(name: &str) -> Result<(), StringLengthValidationError> {
    validate_string_length(name, MIN_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH)
}

pub fn validate_group_name(name: &str, is_public: bool, subtype: Option<&GroupSubtype>) -> Result<(), NameValidationError> {
    match validate_string_length(name, MIN_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH) {
        Ok(()) => {
            if is_public
                && !subtype
                    .map(|t| matches!(t, GroupSubtype::GovernanceProposals(_)))
                    .unwrap_or_default()
                && name.to_lowercase().ends_with("proposals")
            {
                Err(NameValidationError::Reserved)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(s)) => Err(NameValidationError::TooShort(s)),
        Err(StringLengthValidationError::TooLong(l)) => Err(NameValidationError::TooLong(l)),
    }
}

pub fn validate_user_group_name(name: &str) -> Result<(), UsernameValidationError> {
    match validate_string_length(name, MIN_USER_GROUP_NAME_LENGTH, MAX_USER_GROUP_NAME_LENGTH) {
        Ok(()) => {
            if !name.chars().any(|c| c.is_ascii_whitespace()) {
                let lower_name = name.to_lowercase();
                if !RESERVED_GROUP_NAMES.contains(&lower_name.as_str()) {
                    return Ok(());
                }
            }

            Err(UsernameValidationError::Invalid)
        }
        Err(StringLengthValidationError::TooShort(s)) => Err(UsernameValidationError::TooShort(s)),
        Err(StringLengthValidationError::TooLong(l)) => Err(UsernameValidationError::TooLong(l)),
    }
}

pub fn validate_description(description: &str) -> Result<(), FieldTooLongResult> {
    validate_string_length(description, 0, MAX_GROUP_DESCRIPTION_LENGTH).map_err(|e| match e {
        StringLengthValidationError::TooLong(f) => f,
        _ => unreachable!(),
    })
}

pub fn validate_rules(enabled: bool, rules: &str) -> Result<(), RulesValidationError> {
    let min_length = if enabled { 1 } else { 0 };

    validate_string_length(rules, min_length, MAX_GROUP_RULES_LENGTH).map_err(|e| match e {
        StringLengthValidationError::TooShort(f) => RulesValidationError::TooShort(f),
        StringLengthValidationError::TooLong(f) => RulesValidationError::TooLong(f),
    })
}

fn validate_string_length(value: &str, min_length: u32, max_length: u32) -> Result<(), StringLengthValidationError> {
    let length = value.chars().count() as u32;
    if length < min_length {
        Err(StringLengthValidationError::TooShort(FieldTooShortResult {
            length_provided: length,
            min_length,
        }))
    } else if length > max_length {
        Err(StringLengthValidationError::TooLong(FieldTooLongResult {
            length_provided: length,
            max_length,
        }))
    } else {
        Ok(())
    }
}

pub enum NameValidationError {
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
    Reserved,
}

impl From<NameValidationError> for OCError {
    fn from(value: NameValidationError) -> Self {
        match value {
            NameValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            NameValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
            NameValidationError::Reserved => OCErrorCode::NameReserved.into(),
        }
    }
}

pub enum RulesValidationError {
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
}

impl From<RulesValidationError> for OCError {
    fn from(value: RulesValidationError) -> Self {
        match value {
            RulesValidationError::TooShort(s) => OCErrorCode::RulesTooShort.with_json(&s),
            RulesValidationError::TooLong(l) => OCErrorCode::RulesTooLong.with_json(&l),
        }
    }
}

pub enum StringLengthValidationError {
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_usernames() {
        let blocked = Vec::new();

        assert!(validate_username("abcde", &blocked).is_ok());
        assert!(validate_username("12345", &blocked).is_ok());
        assert!(validate_username("SNSABC", &blocked).is_ok());
        assert!(validate_username("TwentyCharactersLong", &blocked).is_ok());
    }

    #[test]
    fn invalid_usernames() {
        let blocked = ["ocbot*".to_string()];

        assert!(matches!(
            validate_username("1_2_3_4_5_6_7_8_9_0_1_2_3_4", &blocked),
            Err(UsernameValidationError::TooLong(_))
        ));
        assert!(matches!(
            validate_username("abcd", &blocked),
            Err(UsernameValidationError::TooShort(_))
        ));
        assert!(matches!(
            validate_username("ab cde", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("ab cde", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("_abcde", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("abcde_", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("ab__cde", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("ab,cde", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("abcéd", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("abcṷd", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("abc王d", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("OpenChat_Bot", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("SNS1Bot", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("SNS2_B0T", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(
            validate_username("OcBot_123", &blocked),
            Err(UsernameValidationError::Invalid)
        ));
    }

    #[test]
    fn valid_display_names() {
        let blocked = [];

        assert!(validate_display_name("John* $Smith--(*)", &blocked).is_ok());
        assert!(validate_display_name("John 👍️ Smith", &blocked).is_ok());
        assert!(validate_display_name("早期用户有保证奖励", &blocked).is_ok());
        assert!(validate_display_name("Jon", &blocked).is_ok());
        assert!(validate_display_name("The fox jumps over John S", &blocked).is_ok());
    }

    #[test]
    fn invalid_display_names() {
        let blocked = ["ocbot*".to_string()];

        assert!(validate_display_name("JS", &blocked).is_err());
        assert!(validate_display_name("The fox jumps over John Smith", &blocked).is_err());
        assert!(validate_display_name(" John Smith", &blocked).is_err());
        assert!(validate_display_name("John Smith ", &blocked).is_err());
        assert!(validate_display_name("John    Smith", &blocked).is_err());
        assert!(validate_display_name("John  Smith", &blocked).is_err());
        assert!(validate_display_name("John\nSmith", &blocked).is_err());
        assert!(validate_display_name("John\tSmith", &blocked).is_err());
        assert!(validate_display_name("John/Smith", &blocked).is_err());
        assert!(validate_display_name("John@Smith", &blocked).is_err());
        assert!(validate_display_name("John<Smith", &blocked).is_err());
        assert!(validate_display_name("John>Smith", &blocked).is_err());
        assert!(validate_display_name("John'Smith", &blocked).is_err());
        assert!(validate_display_name("John\"Smith", &blocked).is_err());
        assert!(validate_display_name("John`Smith", &blocked).is_err());
        assert!(validate_display_name("John#Smith", &blocked).is_err());
        assert!(validate_display_name("John💎Smith", &blocked).is_err());
        assert!(validate_display_name("OcBot_123", &blocked).is_err());
    }

    #[test]
    fn valid_user_group_names() {
        assert!(validate_user_group_name("J_S").is_ok());
        assert!(validate_user_group_name("The_fox_jumps_over_John_S").is_ok());
        assert!(validate_user_group_name("JohnSmith").is_ok());
    }

    #[test]
    fn invalid_user_group_names() {
        assert!(validate_user_group_name("JS").is_err());
        assert!(validate_user_group_name("The_fox_jumps_over_John_Smith").is_err());
        assert!(validate_user_group_name("John Smith").is_err());
    }
}
