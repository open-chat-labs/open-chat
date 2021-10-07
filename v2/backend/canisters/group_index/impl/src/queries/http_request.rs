use crate::LOGGER;
use http_request::{encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, TimestampMillis};
use utils::canister_logger::LogMessagesContainer;

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>, messages_container: &LogMessagesContainer) -> HttpResponse {
        encode_logs(messages_container.get(since.unwrap_or(0)))
    }

    match extract_route(&request.url) {
        Route::Logs(since) => LOGGER.with(|c| get_logs_impl(since, c.borrow().messages_container())),
        _ => HttpResponse::not_found(),
    }
}
