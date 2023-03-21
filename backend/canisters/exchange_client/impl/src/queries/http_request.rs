use crate::{read_state, RuntimeState};
use http_request::{encode_logs, extract_route, get_metrics, Route};
use ic_cdk_macros::query;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::io::Write;
use types::{HeaderField, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        get_metrics(&runtime_state.metrics())
    }

    fn get_order_logs(runtime_state: &RuntimeState) -> HttpResponse {
        let mut body = Vec::new();

        let skip = runtime_state.data.orders_log.len().saturating_sub(200);

        for log in runtime_state.data.orders_log.iter().skip(skip as usize) {
            writeln!(&mut body, "{log}").unwrap();
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

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p) if p == "orders" => read_state(get_order_logs),
        _ => HttpResponse::not_found(),
    }
}
