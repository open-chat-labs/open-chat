use crate::{read_state, RuntimeState, LOG_MESSAGES};
use canister_logger::LogMessagesContainer;
use http_request::{encode_logs, extract_route, get_metrics, Route};
use ic_cdk_macros::query;
use ledger_utils::default_ledger_account;
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use types::{HeaderField, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>, messages_container: &LogMessagesContainer) -> HttpResponse {
        encode_logs(messages_container.get(since.unwrap_or(0)))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        get_metrics(&runtime_state.metrics())
    }

    fn get_ledger_account_impl(runtime_state: &RuntimeState) -> HttpResponse {
        let ledger_account = default_ledger_account(runtime_state.env.canister_id()).to_string();
        let body = ledger_account.into_bytes();

        HttpResponse {
            status_code: 200,
            headers: vec![
                HeaderField("Content-Type".to_string(), "text/plain".to_string()),
                HeaderField("Content-Length".to_string(), body.len().to_string()),
            ],
            body: Cow::Owned(ByteBuf::from(body)),
        }
    }

    match extract_route(&request.url) {
        Route::Logs(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().logs)),
        Route::Traces(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().traces)),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path) if path == "ledger_account" => read_state(get_ledger_account_impl),
        _ => HttpResponse::not_found(),
    }
}
