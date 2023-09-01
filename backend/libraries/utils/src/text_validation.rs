use types::{FieldTooLongResult, FieldTooShortResult, GroupSubtype};

const MIN_USERNAME_LENGTH: u16 = 5;
const MAX_USERNAME_LENGTH: u16 = 15;
const MIN_DISPLAY_NAME_LENGTH: u16 = 3;
const MAX_DISPLAY_NAME_LENGTH: u16 = 25;
const MIN_GROUP_NAME_LENGTH: u32 = 3;
const MAX_GROUP_NAME_LENGTH: u32 = 25;
const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;
const MAX_GROUP_RULES_LENGTH: u32 = 1024;
const MIN_USER_GROUP_NAME_LENGTH: u32 = 3;
const MAX_USER_GROUP_NAME_LENGTH: u32 = 25;

pub enum UsernameValidationError {
    TooLong(u16),
    TooShort(u16),
    Invalid,
}

pub fn validate_display_name(display_name: &str) -> Result<(), UsernameValidationError> {
    const FORBIDDEN_CHARS: [char; 10] = ['@', '<', '>', '/', '\\', '#', '"', '\'', '`', '💎'];
    match validate_string_length(display_name, MIN_DISPLAY_NAME_LENGTH as u32, MAX_DISPLAY_NAME_LENGTH as u32) {
        Ok(()) => {
            if display_name.starts_with(' ')
                || display_name.ends_with(' ')
                || display_name.contains(|c: char| c.is_ascii_whitespace() && c != ' ')
                || display_name.contains("  ")
                || (display_name.chars().any(|c| FORBIDDEN_CHARS.contains(&c)))
            {
                Err(UsernameValidationError::Invalid)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(_)) => Err(UsernameValidationError::TooShort(MIN_DISPLAY_NAME_LENGTH)),
        Err(StringLengthValidationError::TooLong(_)) => Err(UsernameValidationError::TooLong(MAX_DISPLAY_NAME_LENGTH)),
    }
}

pub fn validate_username(username: &str) -> Result<(), UsernameValidationError> {
    match validate_string_length(username, MIN_USERNAME_LENGTH as u32, MAX_USERNAME_LENGTH as u32) {
        Ok(()) => {
            if username.starts_with('_')
                || username.ends_with('_')
                || username.contains("__")
                || (username.chars().any(|c| !c.is_ascii_alphanumeric() && c != '_'))
                || is_username_reserved(username)
            {
                Err(UsernameValidationError::Invalid)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(_)) => Err(UsernameValidationError::TooShort(MIN_USERNAME_LENGTH)),
        Err(StringLengthValidationError::TooLong(_)) => Err(UsernameValidationError::TooLong(MAX_USERNAME_LENGTH)),
    }
}

fn is_username_reserved(username: &str) -> bool {
    let normalised = username.replace('_', "").to_uppercase();
    let is_bot_like = normalised.ends_with("BOT") || normalised.ends_with("B0T");

    if is_bot_like {
        if normalised == "OPENCHATBOT" {
            return true;
        }
        if normalised.starts_with("SNS") {
            return true;
        }
    }

    false
}

pub fn validate_community_name(name: &str, is_public: bool) -> Result<(), NameValidationError> {
    validate_group_name(name, is_public, None)
}

pub fn validate_group_name(name: &str, is_public: bool, subtype: Option<&GroupSubtype>) -> Result<(), NameValidationError> {
    match validate_string_length(name, MIN_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH) {
        Ok(()) => {
            if is_public
                && !subtype
                    .map(|t| matches!(t, GroupSubtype::GovernanceProposals(_)))
                    .unwrap_or_default()
                && name.to_lowercase().contains("proposals")
            {
                Err(NameValidationError::Reserved)
            } else {
                Ok(())
            }
        }
        Err(StringLengthValidationError::TooShort(f)) => Err(NameValidationError::TooShort(f)),
        Err(StringLengthValidationError::TooLong(f)) => Err(NameValidationError::TooLong(f)),
    }
}

pub fn validate_user_group_name(name: &str) -> Result<(), StringLengthValidationError> {
    validate_string_length(name, MIN_USER_GROUP_NAME_LENGTH, MAX_USER_GROUP_NAME_LENGTH)
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

pub enum RulesValidationError {
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
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
        assert!(validate_username("abcde").is_ok());
        assert!(validate_username("12345").is_ok());
        assert!(validate_username("SNSABC").is_ok());
        assert!(validate_username("1_2_3_4_5_6_7_8").is_ok());
    }

    #[test]
    fn invalid_usernames() {
        assert!(matches!(
            validate_username("1_2_3_4_5_6_7_8_9_0_1_2_3_4"),
            Err(UsernameValidationError::TooLong(_))
        ));
        assert!(matches!(validate_username("abcd"), Err(UsernameValidationError::TooShort(_))));
        assert!(matches!(validate_username("ab cde"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("ab cde"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("_abcde"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("abcde_"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("ab__cde"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("ab,cde"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("abcéd"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("abcṷd"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("abc王d"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(
            validate_username("OpenChat_Bot"),
            Err(UsernameValidationError::Invalid)
        ));
        assert!(matches!(validate_username("SNS1Bot"), Err(UsernameValidationError::Invalid)));
        assert!(matches!(validate_username("SNS2_B0T"), Err(UsernameValidationError::Invalid)));
    }

    #[test]
    fn valid_display_names() {
        assert!(validate_display_name("John* $Smith--(*)").is_ok());
        assert!(validate_display_name("John 👍️ Smith").is_ok());
        assert!(validate_display_name("早期用户有保证奖励").is_ok());
        assert!(validate_display_name("Jon").is_ok());
        assert!(validate_display_name("The fox jumps over John S").is_ok());
    }

    #[test]
    fn invalid_display_names() {
        assert!(validate_display_name("JS").is_err());
        assert!(validate_display_name("The fox jumps over John Smith").is_err());
        assert!(validate_display_name(" John Smith").is_err());
        assert!(validate_display_name("John Smith ").is_err());
        assert!(validate_display_name("John    Smith").is_err());
        assert!(validate_display_name("John  Smith").is_err());
        assert!(validate_display_name("John\nSmith").is_err());
        assert!(validate_display_name("John\tSmith").is_err());
        assert!(validate_display_name("John/Smith").is_err());
        assert!(validate_display_name("John@Smith").is_err());
        assert!(validate_display_name("John<Smith").is_err());
        assert!(validate_display_name("John>Smith").is_err());
        assert!(validate_display_name("John'Smith").is_err());
        assert!(validate_display_name("John\"Smith").is_err());
        assert!(validate_display_name("John`Smith").is_err());
        assert!(validate_display_name("John#Smith").is_err());
        assert!(validate_display_name("John💎Smith").is_err());
    }
}
