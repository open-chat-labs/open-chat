use crate::{read_state, RuntimeState};
use http_request::{build_json_response, build_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use std::io::Write;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        build_json_response(&runtime_state.metrics())
    }

    fn get_order_logs(runtime_state: &RuntimeState) -> HttpResponse {
        let mut body = Vec::new();

        let skip = runtime_state.data.orders_log.len().saturating_sub(200);

        for log in runtime_state.data.orders_log.iter().skip(skip as usize) {
            writeln!(&mut body, "{log}").unwrap();
        }

        build_response(body, "text/plain")
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, _) if p == "orders" => read_state(get_order_logs),
        _ => HttpResponse::not_found(),
    }
}
