use canister_logger::LogEntry;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::io::Write;
use types::{HeaderField, HttpResponse, TimestampMillis};

pub fn encode_logs(entries: Vec<LogEntry>, since: TimestampMillis) -> HttpResponse {
    let mut body = Vec::new();

    for entry in entries.into_iter().filter(|e| e.timestamp > since) {
        writeln!(&mut body, "{}", entry.message).unwrap();
    }

    HttpResponse {
        status_code: 200,
        headers: vec![
            HeaderField("Content-Type".to_string(), "text/plain".to_string()),
            HeaderField("Content-Length".to_string(), body.len().to_string()),
        ],
        body: Cow::Owned(ByteBuf::from(body)),
        streaming_strategy: None,
    }
}
