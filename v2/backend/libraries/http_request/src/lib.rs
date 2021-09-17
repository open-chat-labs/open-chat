use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::str::FromStr;
use types::{CanisterId, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, Token};
use utils::blob_storage::BlobStorage;

mod avatar;
mod blob;

pub struct CanisterData<'a> {
    pub blob_storage: &'a BlobStorage,
    pub avatar_blob_id: Option<u128>,
}

pub fn http_request_impl(request: HttpRequest, canister_id: CanisterId, canister_data: CanisterData) -> HttpResponse {
    let response = if is_avatar_request(&request.url) {
        if let Some(blob_id) = canister_data.avatar_blob_id {
            avatar::handle_http_request(request, canister_id, canister_data.blob_storage, blob_id)
        } else {
            None
        }
    } else if let Some(blob_id) = try_extract_blob_id_from_path(&request.url) {
        blob::handle_http_request(request, canister_id, canister_data.blob_storage, blob_id)
    } else {
        None
    };

    match response {
        Some(r) => r,
        None => HttpResponse {
            status_code: 404,
            headers: Vec::new(),
            body: Cow::default(),
            streaming_strategy: None,
        },
    }
}

pub fn http_request_streaming_callback_impl(token: Token, canister_data: CanisterData) -> StreamingCallbackHttpResponse {
    let response = if is_avatar_request(&token.key) {
        if let Some(blob_id) = canister_data.avatar_blob_id {
            avatar::handle_http_request_streaming_callback(token, canister_data.blob_storage, blob_id)
        } else {
            None
        }
    } else if let Some(blob_id) = try_extract_blob_id_from_path(&token.key) {
        blob::handle_http_request_streaming_callback(token, canister_data.blob_storage, blob_id)
    } else {
        None
    };

    match response {
        Some(r) => r,
        None => StreamingCallbackHttpResponse {
            body: ByteBuf::new(),
            token: None,
        },
    }
}

fn is_avatar_request(path: &str) -> bool {
    path.trim_start_matches('/').trim_end_matches('/').to_lowercase() == "avatar"
}

fn try_extract_blob_id_from_path(path: &str) -> Option<u128> {
    if let Some(parts) = path.trim_start_matches('/').split_once('/') {
        if parts.0 == "blobs" {
            return u128::from_str(parts.1).ok();
        }
    }
    None
}
