use crate::{RuntimeState, LOG_MESSAGES, RUNTIME_STATE};
use canister_logger::LogMessagesContainer;
use http_request::{encode_logs, extract_route, get_metrics, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>, messages_container: &LogMessagesContainer) -> HttpResponse {
        encode_logs(messages_container.get(since.unwrap_or(0)))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        get_metrics(&runtime_state.metrics())
    }

    match extract_route(&request.url) {
        Route::Logs(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().logs)),
        Route::Traces(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().traces)),
        Route::Metrics => RUNTIME_STATE.with(|state| get_metrics_impl(state.borrow().as_ref().unwrap())),
        _ => HttpResponse::not_found(),
    }
}
