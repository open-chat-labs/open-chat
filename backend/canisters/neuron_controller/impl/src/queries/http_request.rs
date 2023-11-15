use crate::{read_state, RuntimeState};
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    fn get_signed_requests(state: &RuntimeState) -> HttpResponse {
        let signed_requests: Vec<_> = state.data.signed_requests.iter().rev().take(20).collect();

        build_json_response(&signed_requests)
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "signed_requests" => read_state(get_signed_requests),
        _ => HttpResponse::not_found(),
    }
}
