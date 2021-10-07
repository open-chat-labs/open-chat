use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::io::Write;
use types::{HeaderField, HttpResponse};
use utils::canister_logger::LogMessage;

pub fn encode_logs(messages: Vec<LogMessage>) -> HttpResponse {
    let mut body = Vec::new();

    for message in messages.into_iter() {
        writeln!(&mut body, "{}", message.json).unwrap();
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
