use crate::{RuntimeState, calc_chunk_count, read_state};
use http_request::{Route, build_json_response, encode_logs, extract_route};
use ic_cdk::query;
use num_traits::cast::ToPrimitive;
use std::cmp::min;
use std::num::ParseIntError;
use std::str::FromStr;
use types::{
    CallbackFunc, FileId, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy,
    TimestampMillis, Token,
};

const BLOB_RESPONSE_CHUNK_SIZE_BYTES: u32 = 1 << 19; // 1/2 MB
const CACHE_HEADER_VALUE: &str = "public, max-age=100000000, immutable";

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_errors_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_errors(), since.unwrap_or(0))
    }

    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    match extract_route(&request.url) {
        Route::File(file_id) => read_state(|state| start_streaming_file(file_id, &request.headers, state)),
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        _ => HttpResponse::not_found(),
    }
}

#[query]
fn http_request_streaming_callback(token: Token) -> StreamingCallbackHttpResponse {
    read_state(|state| continue_streaming_file(token, state))
}

fn start_streaming_file(file_id: FileId, headers: &[(String, String)], state: &RuntimeState) -> HttpResponse {
    if let Some(file) = state.data.files.get(&file_id) {
        let range = extract_range_from_headers(headers);

        if let Some(bytes) = match range {
            None | Some((None, None)) => state.data.files.blob_bytes(&file.hash),
            Some((Some(start), end)) => state.data.files.blob_bytes_range(&file.hash, start, end),
            Some((None, Some(suffix))) => state.data.files.blob_bytes_suffix(&file.hash, suffix),
        } {
            let canister_id = state.env.canister_id();

            let (chunk_bytes, stream_next_chunk) = chunk_bytes(bytes, 0);

            let streaming_strategy = if stream_next_chunk {
                Some(StreamingStrategy::Callback {
                    callback: CallbackFunc::new(canister_id, "http_request_streaming_callback".to_string()),
                    token: build_token(file_id, 1),
                })
            } else {
                None
            };

            return HttpResponse {
                status_code: 200,
                headers: vec![
                    HeaderField("Content-Type".to_string(), file.mime_type.clone()),
                    HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_string()),
                    HeaderField("X-Cacheable-Resource".to_string(), "true".to_string()),
                    HeaderField("Access-Control-Allow-Origin".to_string(), "*".to_string()),
                    HeaderField(
                        "Content-Security-Policy".to_string(),
                        "default-src 'none'; img-src *; media-src *; style-src 'unsafe-inline'".to_string(),
                    ),
                ],
                body: chunk_bytes,
                streaming_strategy,
                upgrade: None,
            };
        }
    }

    HttpResponse::not_found()
}

fn continue_streaming_file(token: Token, state: &RuntimeState) -> StreamingCallbackHttpResponse {
    if let Route::File(file_id) = extract_route(&token.key) {
        let chunk_index = token.index.0.to_u32().unwrap();
        let files = &state.data.files;

        if let Some(bytes) = files.get(&file_id).and_then(|f| files.blob_bytes(&f.hash)) {
            let (chunk_bytes, stream_next_chunk) = chunk_bytes(bytes, chunk_index);

            let token = if stream_next_chunk { Some(build_token(file_id, chunk_index + 1)) } else { None };
            return StreamingCallbackHttpResponse {
                body: chunk_bytes,
                token,
            };
        }
    }

    StreamingCallbackHttpResponse {
        body: Vec::new(),
        token: None,
    }
}

fn chunk_bytes(mut blob_bytes: Vec<u8>, chunk_index: u32) -> (Vec<u8>, bool) {
    let total_size = blob_bytes.len();
    let total_chunks = calc_chunk_count(BLOB_RESPONSE_CHUNK_SIZE_BYTES, total_size as u64);
    let last_chunk_index = total_chunks - 1;
    let stream_next_chunk = chunk_index < last_chunk_index;

    if chunk_index > last_chunk_index {
        panic!("Invalid request");
    }

    let start = (BLOB_RESPONSE_CHUNK_SIZE_BYTES as usize) * (chunk_index as usize);
    let end = min(start + (BLOB_RESPONSE_CHUNK_SIZE_BYTES as usize), total_size);

    blob_bytes.drain(end..);
    blob_bytes.drain(0..start);

    (blob_bytes, stream_next_chunk)
}

fn build_token(blob_id: u128, index: u32) -> Token {
    Token {
        key: format!("blobs/{blob_id}"),
        content_encoding: String::default(),
        index: index.into(),
        sha256: None,
    }
}

fn extract_range_from_headers(headers: &[(String, String)]) -> Option<(Option<usize>, Option<usize>)> {
    let range = headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("range"))
        .map(|(_, v)| v)?;

    let (key, value) = range.split_once("=")?;

    if !key.trim().eq_ignore_ascii_case("bytes") {
        return None;
    }

    let (start, end) = value.split_once("-")?;

    let start = parse_range_limit(start).ok()?;
    let end = parse_range_limit(end).ok()?;

    Some((start, end))
}

fn parse_range_limit(s: &str) -> Result<Option<usize>, ParseIntError> {
    let s = s.trim();
    if s.is_empty() { Ok(None) } else { usize::from_str(s).map(|u| Some(u)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case("bytes=1-100", Some((Some(1), Some(100))))]
    #[test_case("bytes=0-", Some((Some(0), None)))]
    #[test_case("bytes=-100", Some((None, Some(100))))]
    #[test_case("bytes=a-b", None)]
    fn extract_range_from_headers_tests(input: &str, expected: Option<(Option<usize>, Option<usize>)>) {
        let result = extract_range_from_headers(&[("Range".to_string(), input.to_string())]);
        assert_eq!(result, expected);
    }
}
