const MAX_DISPLAY_NAME_LENGTH: u16 = 25;
const MIN_DISPLAY_NAME_LENGTH: u16 = 3;

pub enum DisplayNameValidationError {
    TooLong(u16),
    TooShort(u16),
    Invalid,
}

pub fn validate_display_name(display_name: &str) -> Result<(), DisplayNameValidationError> {
    let length = display_name.chars().count();
    if length > MAX_DISPLAY_NAME_LENGTH as usize {
        return Err(DisplayNameValidationError::TooLong(MAX_DISPLAY_NAME_LENGTH));
    }

    if length < MIN_DISPLAY_NAME_LENGTH as usize {
        return Err(DisplayNameValidationError::TooShort(MIN_DISPLAY_NAME_LENGTH));
    }

    if is_display_name_reserved(display_name) {
        return Err(DisplayNameValidationError::Invalid);
    }

    Ok(())
}

fn is_display_name_reserved(display_name: &str) -> bool {
    let normalised = display_name.replace('_', "").to_uppercase();
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
