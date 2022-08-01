use types::{FieldTooLongResult, FieldTooShortResult};

const MIN_GROUP_NAME_LENGTH: usize = 4;
const MAX_GROUP_NAME_LENGTH: usize = 25;

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

pub enum NameValidationError {
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
    Reserved,
}
