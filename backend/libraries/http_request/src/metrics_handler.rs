use serde::Serialize;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use types::{HeaderField, HttpResponse};

pub fn get_metrics<T: Serialize>(metrics: &T) -> HttpResponse {
    let body = serde_json::to_string(metrics).unwrap().into_bytes();
    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), "application/json".to_string()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body: Cow::Owned(ByteBuf::from(body)),
        streaming_strategy: None,
    }
}
