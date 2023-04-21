use crate::build_response;
use canister_logger::LogEntry;
use std::io::Write;
use types::{HttpResponse, TimestampMillis};

pub fn encode_logs(entries: Vec<LogEntry>, since: TimestampMillis) -> HttpResponse {
    let mut body = Vec::new();

    for entry in entries.into_iter().filter(|e| e.timestamp > since) {
        writeln!(&mut body, "{}", entry.message).unwrap();
    }

    build_response(body, "text/plain")
}
