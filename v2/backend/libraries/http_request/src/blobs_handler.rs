use crate::{extract_route, Route};
use blob_storage::BlobStorage;
use candid::Func;
use num_traits::ToPrimitive;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use types::{Avatar, CanisterId, HeaderField, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy, Token};

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

pub fn get_blob(blob_id: u128, canister_id: CanisterId, blob_storage: &BlobStorage) -> HttpResponse {
    match start_streaming_blob(canister_id, blob_storage, blob_id) {
        Some(response) => response,
        None => HttpResponse::gone(),
    }
}

pub fn continue_streaming_blob(token: Token, blob_storage: &BlobStorage) -> StreamingCallbackHttpResponse {
    if let Route::Blob(blob_id) = extract_route(&token.key) {
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
    }

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
