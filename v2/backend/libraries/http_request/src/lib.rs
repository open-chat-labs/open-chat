use candid::Func;
use num_traits::cast::ToPrimitive;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::str::FromStr;
use types::{CanisterId, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy, Token};
use url::Url;
use utils::blob_storage::BlobStorage;

pub fn http_request_impl(request: HttpRequest, canister_id: CanisterId, blob_storage: &BlobStorage) -> HttpResponse {
    fn try_extract_blob_id(url: &str) -> Option<u128> {
        let url = Url::parse(url).ok()?;
        try_extract_blob_id_from_path(url.path())
    }

    if let Some(blob_id) = try_extract_blob_id(&request.url) {
        if let GetChunkResult::Success(r) = get_chunk(blob_id, 0, canister_id, blob_storage) {
            return HttpResponse {
                status_code: 200,
                headers: vec![
                    HeaderField("Cache-Control".to_string(), "max-age=1000000000".to_string()),
                    HeaderField("Cache-Control".to_string(), "immutable".to_string()),
                ],
                body: Cow::Owned(r.bytes),
                streaming_strategy: r.streaming_strategy,
            };
        }
    }

    HttpResponse {
        status_code: 404,
        headers: Vec::new(),
        body: Cow::default(),
        streaming_strategy: None,
    }
}

pub fn http_request_streaming_callback_impl(
    token: Token,
    canister_id: CanisterId,
    blob_storage: &BlobStorage,
) -> StreamingCallbackHttpResponse {
    if let Some(blob_id) = try_extract_blob_id_from_path(&token.key) {
        if let GetChunkResult::Success(r) = get_chunk(blob_id, token.index.0.to_u32().unwrap(), canister_id, blob_storage) {
            return StreamingCallbackHttpResponse {
                body: r.bytes,
                token: r.streaming_strategy.map(|s| {
                    let StreamingStrategy::Callback { token, .. } = s;
                    token
                }),
            };
        }
    }
    StreamingCallbackHttpResponse {
        body: ByteBuf::new(),
        token: None,
    }
}

fn try_extract_blob_id_from_path(path: &str) -> Option<u128> {
    if let Some(parts) = path.trim_start_matches('/').split_once('/') {
        if parts.0 == "blobs" {
            return u128::from_str(parts.1).ok();
        }
    }
    None
}

enum GetChunkResult {
    Success(GetChunkSuccess),
    NotFound,
}

struct GetChunkSuccess {
    bytes: ByteBuf,
    streaming_strategy: Option<StreamingStrategy>,
}

fn get_chunk(blob_id: u128, chunk_index: u32, canister_id: CanisterId, blob_storage: &BlobStorage) -> GetChunkResult {
    match blob_storage.get_chunk(blob_id, chunk_index) {
        Some(bytes) => {
            let next_chunk_index = chunk_index + 1;
            let streaming_strategy = if blob_storage.exists(blob_id, next_chunk_index) {
                Some(StreamingStrategy::Callback {
                    callback: Func {
                        principal: canister_id,
                        method: "http_request_streaming_callback".to_string(),
                    },
                    token: Token {
                        key: blob_id.to_string(),
                        content_encoding: String::default(),
                        index: next_chunk_index.into(),
                        sha256: None,
                    },
                })
            } else {
                None
            };
            GetChunkResult::Success(GetChunkSuccess {
                bytes: bytes.clone(),
                streaming_strategy,
            })
        }
        None => GetChunkResult::NotFound,
    }
}
