use std::borrow::Cow;
use types::{Avatar, HeaderField, HttpResponse};

const CACHE_HEADER_VALUE: &str = "public, max-age=100000000, immutable";

pub fn get_avatar(requested_avatar_id: Option<u128>, avatar: &Option<Avatar>) -> HttpResponse {
    if let Some(avatar) = avatar {
        if let Some(requested_avatar_id) = requested_avatar_id {
            if requested_avatar_id == avatar.id {
                HttpResponse {
                    status_code: 200,
                    headers: vec![
                        HeaderField("Content-Type".to_string(), avatar.mime_type.to_owned()),
                        HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_owned()),
                    ],
                    body: Cow::Owned(avatar.data.clone()),
                    streaming_strategy: None,
                }
            } else {
                let location = build_avatar_location(avatar.id);
                HttpResponse::moved_permanently(&location)
            }
        } else {
            let location = build_avatar_location(avatar.id);
            HttpResponse::moved_temporarily(&location, Some(3600))
        }
    } else if requested_avatar_id.is_some() {
        HttpResponse::gone()
    } else {
        HttpResponse::not_found()
    }
}

fn build_avatar_location(blob_id: u128) -> String {
    format!("/avatar/{blob_id}")
}
