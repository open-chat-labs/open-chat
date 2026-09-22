use crate::User;
use oc_error_codes::OCErrorCode;
use types::{FieldTooLongResult, OCResult, TimestampMillis, Timestamped};

const MAX_BIO_LEN: u32 = 2000;

// Sets the user's bio. The caller awards the `SetBio` achievement.
pub fn set_bio(user: &mut User, text: String, now: TimestampMillis) -> OCResult {
    user.verify_not_suspended()?;

    let length_provided = text.chars().count() as u32;
    if length_provided > MAX_BIO_LEN {
        return Err(OCErrorCode::TextTooLong.with_json(&FieldTooLongResult {
            length_provided,
            max_length: MAX_BIO_LEN,
        }));
    }

    user.bio = Timestamped::new(text, now);
    Ok(())
}
