use candid::Func;
use num_traits::cast::ToPrimitive;
use std::borrow::Cow;
use std::str::FromStr;
use types::{CanisterId, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy, Token};
use utils::blob_storage::BlobStorage;

const CACHE_HEADER_VALUE: &str = "public, max-age=900";

pub fn handle_http_request(
    request: HttpRequest,
    canister_id: CanisterId,
    blob_storage: &BlobStorage,
    blob_id: u128,
) -> Option<HttpResponse> {
    if let Some(etag) = request.header("If-None-Match") {
        if let Ok(etag_blob_id) = u128::from_str(etag) {
            if etag_blob_id == blob_id {
                return Some(HttpResponse {
                    status_code: 304,
                    headers: Vec::new(),
                    body: Cow::default(),
                    streaming_strategy: None,
                });
            }
        }
    }

    if let Some(blob) = blob_storage.get_blob(&blob_id) {
        let next_chunk_index = 1;
        if blob_storage.exists(blob_id, next_chunk_index) {
            let streaming_strategy = Some(StreamingStrategy::Callback {
                callback: Func {
                    principal: canister_id,
                    method: "http_request_streaming_callback".to_string(),
                },
                token: build_token(next_chunk_index),
            });

            return Some(HttpResponse {
                status_code: 200,
                headers: vec![
                    HeaderField("Content-Type".to_string(), blob.mime_type().to_string()),
                    HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_string()),
                    HeaderField("ETag".to_string(), blob_id.to_string()),
                ],
                body: Cow::Owned(blob.chunk(0).unwrap().clone()),
                streaming_strategy,
            });
        }
    }

    None
}

pub fn handle_http_request_streaming_callback(
    token: Token,
    blob_storage: &BlobStorage,
    blob_id: u128,
) -> Option<StreamingCallbackHttpResponse> {
    let chunk_index = token.index.0.to_u32().unwrap();
    if let Some(bytes) = blob_storage.get_chunk(blob_id, chunk_index) {
        let next_chunk_index = chunk_index + 1;
        if blob_storage.exists(blob_id, next_chunk_index) {
            let token = Some(build_token(next_chunk_index));
            return Some(StreamingCallbackHttpResponse {
                body: bytes.clone(),
                token,
            });
        }
    }

    None
}

fn build_token(index: u32) -> Token {
    Token {
        key: "avatar".to_owned(),
        content_encoding: String::default(),
        index: index.into(),
        sha256: None,
    }
}
