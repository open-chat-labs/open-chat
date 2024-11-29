use base64::engine::general_purpose::STANDARD;
use base64::Engine;
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
    const SUPPORTED_IMAGE_SUBTYPES: [&str; 7] = ["apng", "avif", "gif", "jpeg", "png", "svg+xml", "webp"];

    let comma = data_url.find(',')?;
    let preamble = data_url.get(0..comma)?;
    let data_str = data_url.get((comma + 1)..)?;
    let preamble = preamble.strip_prefix("data:")?;
    let mime_type = preamble.strip_suffix(";base64")?;
    let sub_type = mime_type.strip_prefix("image/")?;

    if !SUPPORTED_IMAGE_SUBTYPES.contains(&sub_type) {
        return None;
    };

    let data = STANDARD.decode(data_str).ok()?;

    Some(Document {
        id,
        mime_type: mime_type.to_string(),
        data,
    })
}

pub fn to_data_url(document: Document) -> String {
    let mime_type = document.mime_type;
    let data = STANDARD.encode(document.data);
    format!("data:{mime_type};base64,{data}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn try_parse_data_url_succeeds() {
        const TEST_IMAGE: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAABHVBMVEVHcEyx9biGhoYSEhIICAg3Nzcd6iUcHBx/f38KCgoU4iSEhITw6/AA5BsY4CEQEBBeXl6NjI3z7vMaGhoODg5VVVX///8h4yEc0hpdXV06Ojo2NjY0NDSTk5O7u7vf398vMC8H2R4P2Bs1uA8WFhZ2dnYgICBnZ2cj4SId3SAj0hor2x8T2h0xyRaXl5enpacvyhYq1hwp2x4ryxYwzRcyvhEi5iNCQkJXV1cS5CExMTGioqJ3d3exsbE8xxRGRkYzvhFvxnqMjIwg1Bogzxge3yJA00ksLCwwQDJTU1Mp7Ss+g0NtbW025Td0mHihoaEu6iYAAAABAQEiyBUntg4Q4x4Y1BglnwYc2xwO4R0bvhAilgMlpQggqgo1rQvX8MOzAAAAUXRSTlMAATft+qLx2j33RDkQDEvvZjQN3/NyA/VAb56orTAWCc4WK/DnQ9aYnmJt1TLTKiuvovSW9fXzuIY+siJZOeqj3iNYX1qAmru6rt+pgrJBRPUCz/BZAAABY0lEQVQ4y+2S53aCMBiGAbVAgTKl7gU46qp7dO89AhScvf/LaBi24vEO6vMjJyd5kyf5EgTZ8S/J7/uMrjCK4rNwSG5QFHWCBnNMeW/FfY4NqRwcw4osK55ubFjpT6fTL5fnlzAAeBqhUzrQk0IwV6tOrMmhS//z7RHABB318hviiWW17w48Ru8iAGTJabhgDq20DcMqMwjqIcdJAMJQHKE3xcbMqNaEYcRnONAB2CJuGbNZt4I6+3iMP3CwRXzUNU2jxfDiKqcSwitcpFLBYKxuLs16wakGUCMJCJeNPg3cmwee5NhcLHs3rjgclaFBRiiRLEE5GUfXxT3bNjueOHetaVoapcc6KJbgQpxfE1/a84UvBqQkSaG47JS6eJaE9UnRf+Lvua3cunMeDxlCdW/M4/5ZPPG5oigdpgk/ggeuCRcsyybgG3MqK+WafrAQg+SRDLaiIWcxgiAycPK3s+P/8AOj0UZXsNGRawAAAABJRU5ErkJggg==";

        let document = try_parse_data_url(0, TEST_IMAGE);
        assert!(document.is_some());

        let data_url = to_data_url(document.unwrap());
        assert_eq!(data_url, TEST_IMAGE);
    }
}
