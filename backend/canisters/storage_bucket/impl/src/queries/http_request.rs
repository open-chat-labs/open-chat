use crate::model::files::Files;
use crate::{RuntimeState, chunk_bounds, read_state};
use http_request::{Route, build_json_response, encode_logs, extract_route};
use ic_cdk::query;
use num_traits::cast::ToPrimitive;
use std::cmp::max;
use std::num::ParseIntError;
use std::str::FromStr;
use types::{
    CallbackFunc, FileId, Hash, HeaderField, HttpRequest, HttpResponse, StreamingCallbackHttpResponse, StreamingStrategy,
    TimestampMillis, Token,
};

const MAX_RESPONSE_SIZE_BYTES: usize = 3 << 19; // 1.5MB
// Browsers stream media with open-ended ranges (`bytes=N-`) issued strictly one after another, so
// the per-request round trip (gateway + query) dominates throughput. Keep this large enough that
// a typical phone video (3-4Mbps) stays ahead of playback.
const DEFAULT_RANGE_RESPONSE_CHUNK_SIZE: usize = 1 << 20; // 1MB
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

fn start_streaming_file(file_id: FileId, request_headers: &[(String, String)], state: &RuntimeState) -> HttpResponse {
    let files = &state.data.files;
    if let Some(file) = files.get(&file_id)
        // Quarantined blobs are never served publicly. The check is hash-based, so any file
        // referencing a quarantined blob (including re-uploads of the same content) is covered.
        // A hash whose content was upheld as CSAM stays blocked forever, even after the
        // vaulted record itself is released.
        && !files.is_vault_pinned(&file.hash)
        && !state.data.vault.is_csam_hash(&file.hash)
        && let Some(file_size) = files.data_size(&file.hash)
    {
        let file_size = file_size as usize;
        let mut response_headers = vec![
            HeaderField("Content-Type".to_string(), file.mime_type.clone()),
            HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_string()),
            HeaderField("X-Cacheable-Resource".to_string(), "true".to_string()),
            HeaderField("Accept-Ranges".to_string(), "bytes".to_string()),
            HeaderField("Access-Control-Allow-Origin".to_string(), "*".to_string()),
            HeaderField(
                "Content-Security-Policy".to_string(),
                "default-src 'none'; img-src *; media-src *; style-src 'unsafe-inline'".to_string(),
            ),
        ];

        return if let Some(range) = extract_range_from_headers(request_headers) {
            // (start, end) where end is exclusive
            let (start, end) = match range {
                BytesRange::From(start, end) => {
                    if start >= file_size {
                        return range_not_satisfiable(response_headers, file_size);
                    }
                    // The last byte position in a Range header is inclusive
                    let end = [
                        start.saturating_add(MAX_RESPONSE_SIZE_BYTES),
                        file_size,
                        end.map(|e| e.saturating_add(1))
                            .unwrap_or(start.saturating_add(DEFAULT_RANGE_RESPONSE_CHUNK_SIZE)),
                    ]
                    .into_iter()
                    .min()
                    .unwrap();

                    if end <= start {
                        return range_not_satisfiable(response_headers, file_size);
                    }
                    (start, end)
                }
                BytesRange::Suffix(len) => {
                    if len == 0 {
                        return range_not_satisfiable(response_headers, file_size);
                    }
                    // A suffix range is anchored at the end of the file, so cap it by moving the
                    // start forward rather than truncating the tail
                    let start = max(
                        file_size.saturating_sub(len),
                        file_size.saturating_sub(MAX_RESPONSE_SIZE_BYTES),
                    );
                    (start, file_size)
                }
            };

            let range_bytes = files.blob_range(&file.hash, start, end);
            response_headers.push(HeaderField("Content-Length".to_string(), range_bytes.len().to_string()));

            let last_byte = end - 1;
            response_headers.push(HeaderField(
                "Content-Range".to_string(),
                format!("bytes {start}-{last_byte}/{file_size}"),
            ));

            HttpResponse {
                status_code: 206,
                headers: response_headers,
                body: range_bytes,
                streaming_strategy: None,
                upgrade: None,
            }
        } else {
            let canister_id = state.env.canister_id();

            let Some((chunk_bytes, stream_next_chunk)) = read_chunk(files, &file.hash, file_size as u64, 0) else {
                return HttpResponse::not_found();
            };

            let streaming_strategy = if stream_next_chunk {
                Some(StreamingStrategy::Callback {
                    callback: CallbackFunc::new(canister_id, "http_request_streaming_callback".to_string()),
                    token: build_token(file_id, 1),
                })
            } else {
                None
            };

            response_headers.push(HeaderField("Content-Length".to_string(), file_size.to_string()));

            HttpResponse {
                status_code: 200,
                headers: response_headers,
                body: chunk_bytes,
                streaming_strategy,
                upgrade: None,
            }
        };
    }

    HttpResponse::not_found()
}

fn continue_streaming_file(token: Token, state: &RuntimeState) -> StreamingCallbackHttpResponse {
    if let Route::File(file_id) = extract_route(&token.key) {
        let chunk_index = token.index.0.to_u32().unwrap();
        let files = &state.data.files;

        if let Some((chunk_bytes, stream_next_chunk)) = files
            .get(&file_id)
            .filter(|f| !files.is_vault_pinned(&f.hash) && !state.data.vault.is_csam_hash(&f.hash))
            .and_then(|f| {
                let size = files.data_size(&f.hash)?;
                read_chunk(files, &f.hash, size, chunk_index)
            })
        {
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

// Reads the chunk at `chunk_index` (in MAX_RESPONSE_SIZE_BYTES units) and returns whether more chunks follow
fn read_chunk(files: &Files, hash: &Hash, total_size: u64, chunk_index: u32) -> Option<(Vec<u8>, bool)> {
    let (range, chunk_count) = chunk_bounds(MAX_RESPONSE_SIZE_BYTES as u32, total_size, chunk_index)?;
    let bytes = files.blob_range(hash, range.start, range.end);

    Some((bytes, chunk_index + 1 < chunk_count))
}

// RFC 9110 §15.5.17: a 416 should carry `Content-Range: bytes */<size>` so clients can recover
fn range_not_satisfiable(mut headers: Vec<HeaderField>, file_size: usize) -> HttpResponse {
    headers.push(HeaderField("Content-Range".to_string(), format!("bytes */{file_size}")));
    HttpResponse {
        status_code: 416,
        headers,
        body: Vec::new(),
        streaming_strategy: None,
        upgrade: None,
    }
}

fn build_token(blob_id: u128, index: u32) -> Token {
    Token {
        key: format!("blobs/{blob_id}"),
        content_encoding: String::default(),
        index: index.into(),
        sha256: None,
    }
}

#[derive(Debug, Eq, PartialEq)]
enum BytesRange {
    From(usize, Option<usize>),
    Suffix(usize),
}

fn extract_range_from_headers(headers: &[(String, String)]) -> Option<BytesRange> {
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

    if let Some(start) = start {
        Some(BytesRange::From(start, end))
    } else {
        end.map(BytesRange::Suffix)
    }
}

fn parse_range_limit(s: &str) -> Result<Option<usize>, ParseIntError> {
    let s = s.trim();
    if s.is_empty() { Ok(None) } else { usize::from_str(s).map(Some) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case("bytes=1-100", Some(BytesRange::From(1, Some(100))))]
    #[test_case("bytes=0-", Some(BytesRange::From(0, None)))]
    #[test_case("bytes=-100", Some(BytesRange::Suffix(100)))]
    #[test_case("bytes=a-b", None)]
    fn extract_range_from_headers_tests(input: &str, expected: Option<BytesRange>) {
        let result = extract_range_from_headers(&[("Range".to_string(), input.to_string())]);
        assert_eq!(result, expected);
    }
}
