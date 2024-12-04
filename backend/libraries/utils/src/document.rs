use dataurl::DataUrl;
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

pub fn try_parse_data_url(id: u128, data_url: &str) -> Option<Document> {
    let url = DataUrl::parse(data_url).ok()?;

    Some(Document {
        id,
        mime_type: url.get_media_type().to_string(),
        data: url.get_data().to_vec(),
    })
}
