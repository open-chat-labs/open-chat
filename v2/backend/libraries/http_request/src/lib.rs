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
        if let Some(blob) = blob_storage.get_blob(&blob_id) {
            let next_chunk_index = 1;
            let streaming_strategy = if blob_storage.exists(blob_id, next_chunk_index) {
                Some(StreamingStrategy::Callback {
                    callback: Func {
                        principal: canister_id,
                        method: "http_request_streaming_callback".to_string(),
                    },
                    token: Token {
                        key: format!("blobs/{}", blob_id),
                        content_encoding: String::default(),
                        index: next_chunk_index.into(),
                        sha256: None,
                    },
                })
            } else {
                None
            };

            return HttpResponse {
                status_code: 200,
                headers: vec![
                    HeaderField("Cache-Control".to_string(), "max-age=1000000000".to_string()),
                    HeaderField("Cache-Control".to_string(), "immutable".to_string()),
                    HeaderField("Content-Type".to_string(), blob.mime_type().to_string()),
                ],
                body: Cow::Owned(blob.chunk(0).unwrap().clone()),
                streaming_strategy,
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

pub fn http_request_streaming_callback_impl(token: Token, blob_storage: &BlobStorage) -> StreamingCallbackHttpResponse {
    if let Some(blob_id) = try_extract_blob_id_from_path(&token.key) {
        let chunk_index = token.index.0.to_u32().unwrap();
        if let Some(bytes) = blob_storage.get_chunk(blob_id, chunk_index) {
            let next_chunk_index = chunk_index + 1;
            let token = if blob_storage.exists(blob_id, next_chunk_index) {
                Some(Token {
                    key: format!("blobs/{}", blob_id),
                    index: next_chunk_index.into(),
                    content_encoding: String::default(),
                    sha256: None,
                })
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

fn try_extract_blob_id_from_path(path: &str) -> Option<u128> {
    if let Some(parts) = path.trim_start_matches('/').split_once('/') {
        if parts.0 == "blobs" {
            return u128::from_str(parts.1).ok();
        }
    }
    None
}
