use types::{Avatar, FieldTooLongResult};

const MAX_AVATAR_SIZE: u32 = 1024 * 1024; // 1MB

pub fn validate_avatar(avatar: Option<&Avatar>) -> Result<(), FieldTooLongResult> {
    let avatar_length = avatar.map_or(0, |a| a.data.as_ref().len()) as u32;
    if avatar_length > MAX_AVATAR_SIZE {
        Err(FieldTooLongResult {
            length_provided: avatar_length,
            max_length: MAX_AVATAR_SIZE,
        })
    } else {
        Ok(())
    }
}
