use candid::Func;
use num_traits::cast::ToPrimitive;
use std::borrow::Cow;
use types::{CanisterId, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy, Token};
use utils::blob_storage::BlobStorage;

const CACHE_HEADER_VALUE: &str = "public, max-age=100000000, immutable";

pub fn handle_http_request(
    _request: HttpRequest,
    canister_id: CanisterId,
    blob_storage: &BlobStorage,
    blob_id: u128,
) -> Option<HttpResponse> {
    if let Some(blob) = blob_storage.get_blob(&blob_id) {
        let next_chunk_index = 1;
        if blob_storage.exists(blob_id, next_chunk_index) {
            let streaming_strategy = Some(StreamingStrategy::Callback {
                callback: Func {
                    principal: canister_id,
                    method: "http_request_streaming_callback".to_string(),
                },
                token: build_token(blob_id, next_chunk_index),
            });

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
            let token = Some(build_token(blob_id, next_chunk_index));

            return Some(StreamingCallbackHttpResponse {
                body: bytes.clone(),
                token,
            });
        }
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
