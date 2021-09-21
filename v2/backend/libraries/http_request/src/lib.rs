use candid::Func;
use num_traits::cast::ToPrimitive;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::str::FromStr;
use types::{
    Avatar, CanisterId, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy, Token,
};
use utils::blob_storage::BlobStorage;

const CACHE_HEADER_VALUE: &str = "public, max-age=100000000, immutable";

pub struct CanisterData<'a> {
    pub blob_storage: &'a BlobStorage,
    pub avatar: &'a Option<Avatar>,
}

pub fn http_request_impl(request: HttpRequest, canister_id: CanisterId, canister_data: CanisterData) -> HttpResponse {
    match extract_request_type(&request.url) {
        RequestType::Avatar(id) => {
            if let Some(avatar) = &canister_data.avatar {
                if let Some(requested_id) = id {
                    if requested_id == avatar.id {
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
                    HttpResponse::moved_temporariliy(&location, Some(3600))
                }
            } else if id.is_some() {
                HttpResponse::gone()
            } else {
                HttpResponse::not_found()
            }
        }
        RequestType::Blob(blob_id) => match start_streaming_blob(canister_id, canister_data.blob_storage, blob_id) {
            Some(response) => response,
            None => HttpResponse::gone(),
        },
        RequestType::Other => HttpResponse::not_found(),
    }
}

pub fn continue_streaming_blob(token: Token, blob_storage: &BlobStorage) -> StreamingCallbackHttpResponse {
    if let RequestType::Blob(blob_id) = extract_request_type(&token.key) {
        let chunk_index = token.index.0.to_u32().unwrap();
        if let Some(bytes) = blob_storage.get_chunk(blob_id, chunk_index) {
            let next_chunk_index = chunk_index + 1;
            let token = if blob_storage.exists(blob_id, next_chunk_index) {
                Some(build_token(blob_id, next_chunk_index))
            } else {
                None
            };

            return StreamingCallbackHttpResponse {
                body: bytes.clone(),
                token,
            };
        }
    };

    StreamingCallbackHttpResponse {
        body: ByteBuf::new(),
        token: None,
    }
}

fn build_avatar_location(blob_id: u128) -> String {
    format!("/avatar/{}", blob_id)
}

fn start_streaming_blob(canister_id: CanisterId, blob_storage: &BlobStorage, blob_id: u128) -> Option<HttpResponse> {
    if let Some(blob) = blob_storage.get_blob(&blob_id) {
        let next_chunk_index = 1;
        let streaming_strategy = if blob_storage.exists(blob_id, next_chunk_index) {
            Some(StreamingStrategy::Callback {
                callback: Func {
                    principal: canister_id,
                    method: "http_request_streaming_callback".to_string(),
                },
                token: build_token(blob_id, next_chunk_index),
            })
        } else {
            None
        };

        return Some(HttpResponse {
            status_code: 200,
            headers: vec![
                HeaderField("Content-Type".to_string(), blob.mime_type().to_string()),
                HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_string()),
            ],
            body: Cow::Owned(blob.chunk(0).unwrap().clone()),
            streaming_strategy,
        });
    }

    None
}

fn build_token(blob_id: u128, index: u32) -> Token {
    Token {
        key: format!("blobs/{}", blob_id),
        content_encoding: String::default(),
        index: index.into(),
        sha256: None,
    }
}

enum RequestType {
    Avatar(Option<u128>),
    Blob(u128),
    Other,
}

fn extract_request_type(path: &str) -> RequestType {
    let path = path.trim_start_matches('/').trim_end_matches('/').to_lowercase();

    if path == "avatar" {
        return RequestType::Avatar(None);
    } else if let Some(parts) = path.split_once('/') {
        if let Ok(blob_id) = u128::from_str(parts.1) {
            if parts.0 == "blobs" {
                return RequestType::Blob(blob_id);
            } else if parts.0 == "avatar" {
                return RequestType::Avatar(Some(blob_id));
            }
        }
    }

    RequestType::Other
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_avatar_from_url() {
        const BLOB_ID: u128 = 367253521351235123;
        match extract_request_type(&format!("/avatar/{}", BLOB_ID)) {
            RequestType::Avatar(Some(id)) => assert_eq!(BLOB_ID, id),
            _ => assert!(false),
        }
    }

    #[test]
    fn extract_blob_from_url() {
        assert!(matches!(
            extract_request_type("/blobs/78278371289379212398"),
            RequestType::Blob(_)
        ));
    }

    #[test]
    fn extract_other_from_url() {
        assert!(matches!(extract_request_type("blah"), RequestType::Other));
    }
}
