use crate::{read_state, RuntimeState};
use http_request::{encode_logs, extract_route, get_avatar, get_metrics, Route};
use ic_cdk_macros::query;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use types::{HeaderField, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(requested_avatar_id: Option<u128>, runtime_state: &RuntimeState) -> HttpResponse {
        get_avatar(requested_avatar_id, &runtime_state.data.avatar)
    }

    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        get_metrics(&runtime_state.metrics())
    }

    fn get_principals(runtime_state: &RuntimeState) -> HttpResponse {
        let principals: Vec<_> = runtime_state.data.principals.iter().collect();
        let body = serde_json::to_string(&principals).unwrap().into_bytes();

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

    match extract_route(&request.url) {
        Route::Avatar(requested_avatar_id) => read_state(|state| get_avatar_impl(requested_avatar_id, state)),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path) if path == "principals" => read_state(get_principals),
        _ => HttpResponse::not_found(),
    }
}
