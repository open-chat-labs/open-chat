use types::{FieldTooLongResult, FieldTooShortResult};

const MIN_GROUP_NAME_LENGTH: usize = 3;
const MAX_GROUP_NAME_LENGTH: usize = 25;
const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;
const MAX_GROUP_RULES_LENGTH: u32 = 1024;

pub fn validate_name(name: &str, is_public: bool) -> Result<(), NameValidationError> {
    let length = name.len();
    if length < MIN_GROUP_NAME_LENGTH {
        Err(NameValidationError::TooShort(FieldTooShortResult {
            length_provided: length as u32,
            min_length: MIN_GROUP_NAME_LENGTH as u32,
        }))
    } else if length > MAX_GROUP_NAME_LENGTH {
        Err(NameValidationError::TooLong(FieldTooLongResult {
            length_provided: length as u32,
            max_length: MAX_GROUP_NAME_LENGTH as u32,
        }))
    } else if is_public && name.to_lowercase().contains("proposals") {
        Err(NameValidationError::Reserved)
    } else {
        Ok(())
    }
}

pub fn validate_description(description: &str) -> Result<(), FieldTooLongResult> {
    if description.len() <= MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Ok(())
    } else {
        Err(FieldTooLongResult {
            length_provided: description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        })
    }
}

pub fn validate_rules(enabled: bool, rules: &str) -> Result<(), RulesValidationError> {
    if enabled && rules.is_empty() {
        Err(RulesValidationError::TooShort(FieldTooShortResult {
            length_provided: rules.len() as u32,
            min_length: 1,
        }))
    } else if rules.len() > MAX_GROUP_RULES_LENGTH as usize {
        Err(RulesValidationError::TooLong(FieldTooLongResult {
            length_provided: rules.len() as u32,
            max_length: MAX_GROUP_RULES_LENGTH,
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
