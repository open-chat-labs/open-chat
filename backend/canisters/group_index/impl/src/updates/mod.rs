use group_index_canister::{MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH, MIN_GROUP_NAME_LENGTH};
use types::{FieldTooLongResult, FieldTooShortResult};

pub mod c2c_create_group;
pub mod c2c_delete_group;
pub mod c2c_mark_active;
pub mod c2c_notify_low_balance;
pub mod c2c_update_group;
pub mod upgrade_group_canister_wasm;
pub mod wallet_receive;

fn validate_group(name: &str, description: &str) -> Result<(), GroupValidationError> {
    if name.len() < MIN_GROUP_NAME_LENGTH as usize {
        Err(GroupValidationError::NameTooShort(FieldTooShortResult {
            length_provided: name.len() as u32,
            min_length: MIN_GROUP_NAME_LENGTH,
        }))
    } else if name.len() > MAX_GROUP_NAME_LENGTH as usize {
        Err(GroupValidationError::NameTooLong(FieldTooLongResult {
            length_provided: name.len() as u32,
            max_length: MAX_GROUP_NAME_LENGTH,
        }))
    } else if description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(GroupValidationError::DescriptionTooLong(FieldTooLongResult {
            length_provided: description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else {
        Ok(())
    }
}

enum GroupValidationError {
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    DescriptionTooLong(FieldTooLongResult),
}
