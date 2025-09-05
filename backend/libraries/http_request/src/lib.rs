mod document_handler;
mod logs_handler;
mod router;

use serde::Serialize;
use types::{HeaderField, HttpResponse};

pub use document_handler::*;
pub use logs_handler::*;
pub use router::*;

pub fn build_json_response<T: Serialize>(body: &T) -> HttpResponse {
    let bytes = json::serialize(body).unwrap();

    build_response(bytes, "application/json")
}

pub fn build_response(body: Vec<u8>, content_type: impl Into<String>) -> HttpResponse {
    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), content_type.into()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
        streaming_strategy: None,
        upgrade: None,
    }
}
