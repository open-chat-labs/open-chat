const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 5;

pub enum UsernameValidationError {
    TooLong(u16),
    TooShort(u16),
    Invalid,
}

pub fn validate_username(username: &str) -> Result<(), UsernameValidationError> {
    if username.len() > MAX_USERNAME_LENGTH as usize {
        return Err(UsernameValidationError::TooLong(MAX_USERNAME_LENGTH));
    }

    if username.len() < MIN_USERNAME_LENGTH as usize {
        return Err(UsernameValidationError::TooShort(MIN_USERNAME_LENGTH));
    }

    if username.starts_with('_')
        || username.ends_with('_')
        || username.contains("__")
        || username.chars().any(|c| !c.is_ascii_alphanumeric() && c != '_')
        || is_username_reserved(username)
    {
        return Err(UsernameValidationError::Invalid);
    }

    Ok(())
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
