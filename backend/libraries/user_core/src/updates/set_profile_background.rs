use crate::User;
use oc_error_codes::OCErrorCode;
use stable_memory_map::ProfileDocumentType;
use types::{Document, OCResult, TimestampMillis};
use utils::document::validate_profile_background;

// Sets (or clears) the user's profile background, returning the id of the new document for the
// caller to tell the LocalUserIndex about.
pub fn set_profile_background(
    user: &mut User,
    profile_background: Option<Document>,
    now: TimestampMillis,
) -> OCResult<Option<u128>> {
    user.verify_not_suspended()?;
    validate_profile_background(profile_background.as_ref()).map_err(|e| OCErrorCode::ProfileBackgroundTooBig.with_json(&e))?;

    user.profile_background
        .set(ProfileDocumentType::ProfileBackground, profile_background, now);

    Ok(user.profile_background.id())
}
