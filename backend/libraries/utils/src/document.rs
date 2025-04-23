use dataurl::DataUrl;
use twox_hash::xxhash3_128::Hasher;
use types::{Document, FieldTooLongResult};

const MAX_AVATAR_SIZE: u32 = 1024 * 800; // 800KB
const MAX_BANNER_SIZE: u32 = 1024 * 1024; // 1MB

pub fn validate_avatar(avatar: Option<&Document>) -> Result<(), FieldTooLongResult> {
    validate_document(avatar, MAX_AVATAR_SIZE)
}

pub fn validate_banner(avatar: Option<&Document>) -> Result<(), FieldTooLongResult> {
    validate_document(avatar, MAX_BANNER_SIZE)
}

pub fn validate_document(avatar: Option<&Document>, max_size: u32) -> Result<(), FieldTooLongResult> {
    let avatar_length = avatar.map_or(0, |a| a.data.len()) as u32;
    if avatar_length > max_size {
        Err(FieldTooLongResult {
            length_provided: avatar_length,
            max_length: max_size,
        })
    } else {
        Ok(())
    }
}

pub fn try_parse_data_url(data_url: &str) -> Result<Document, String> {
    let url = DataUrl::parse(data_url).map_err(|err| format!("Invalid data URL: {:?}", err))?;
    let mime_type = url.get_media_type().to_string();
    let data = url.get_data().to_vec();
    let id = Hasher::oneshot(&data);

    Ok(Document { id, mime_type, data })
}
