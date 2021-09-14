use crate::{RuntimeState, RUNTIME_STATE};
use candid::Func;
use ic_cdk_macros::query;
use num_traits::cast::ToPrimitive;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::str::FromStr;
use types::{HeaderField, StreamingStrategy, Token};
use url::Url;
use user_canister::http_request::*;

#[query]
fn http_request(args: Args) -> Response {
    fn try_extract_blob_id(url: &str) -> Option<u128> {
        let url = Url::parse(url).ok()?;
        try_extract_blob_id_from_path(url.path())
    }

    if let Some(blob_id) = try_extract_blob_id(&args.url) {
        if let GetChunkResult::Success(r) = RUNTIME_STATE.with(|state| get_chunk(blob_id, 0, state.borrow().as_ref().unwrap()))
        {
            return Response {
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
    Response {
        status_code: 404,
        headers: Vec::new(),
        body: Cow::default(),
        streaming_strategy: None,
    }
}

#[query]
fn http_request_streaming_callback(args: StreamingCallbackArgs) -> StreamingCallbackResponse {
    if let Some(blob_id) = try_extract_blob_id_from_path(&args.key) {
        if let GetChunkResult::Success(r) =
            RUNTIME_STATE.with(|state| get_chunk(blob_id, args.index.0.to_u32().unwrap(), state.borrow().as_ref().unwrap()))
        {
            return StreamingCallbackResponse {
                body: r.bytes,
                token: r.streaming_strategy.map(|s| {
                    let StreamingStrategy::Callback { token, .. } = s;
                    token
                }),
            };
        }
    }
    StreamingCallbackResponse {
        body: ByteBuf::new(),
        token: None,
    }
}

enum GetChunkResult {
    Success(GetChunkSuccess),
    NotFound,
}

struct GetChunkSuccess {
    bytes: ByteBuf,
    streaming_strategy: Option<StreamingStrategy>,
}

fn get_chunk(blob_id: u128, chunk_index: u32, runtime_state: &RuntimeState) -> GetChunkResult {
    match runtime_state.data.blob_storage.get_chunk(blob_id, chunk_index) {
        Some(bytes) => {
            let next_chunk_index = chunk_index + 1;
            let streaming_strategy = if runtime_state.data.blob_storage.exists(blob_id, next_chunk_index) {
                Some(StreamingStrategy::Callback {
                    callback: Func {
                        principal: runtime_state.env.canister_id(),
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

fn try_extract_blob_id_from_path(path: &str) -> Option<u128> {
    if let Some(parts) = path.trim_start_matches('/').split_once('/') {
        if parts.0 == "blobs" {
            return u128::from_str(parts.1).ok();
        }
    }
    None
}
