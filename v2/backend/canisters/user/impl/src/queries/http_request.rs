use crate::{RuntimeState, LOG_MESSAGES, RUNTIME_STATE};
use canister_logger::LogMessagesContainer;
use http_request::{continue_streaming_blob, encode_logs, extract_route, get_avatar, get_blob, get_metrics, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, StreamingCallbackHttpResponse, TimestampMillis, Token};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(requested_avatar_id: Option<u128>, runtime_state: &RuntimeState) -> HttpResponse {
        get_avatar(requested_avatar_id, &runtime_state.data.avatar)
    }

    fn get_blob_impl(blob_id: u128, runtime_state: &RuntimeState) -> HttpResponse {
        let canister_id = runtime_state.env.canister_id();
        let blob_storage = &runtime_state.data.blob_storage;
        let blob_hashes = &runtime_state.blob_hashes;
        get_blob(blob_id, canister_id, blob_storage, blob_hashes)
    }

    fn get_logs_impl(since: Option<TimestampMillis>, messages_container: &LogMessagesContainer) -> HttpResponse {
        encode_logs(messages_container.get(since.unwrap_or(0)))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        get_metrics(&runtime_state.metrics())
    }

    match extract_route(&request.url) {
        Route::Avatar(requested_avatar_id) => {
            RUNTIME_STATE.with(|state| get_avatar_impl(requested_avatar_id, state.borrow().as_ref().unwrap()))
        }
        Route::Blob(blob_id) => RUNTIME_STATE.with(|state| get_blob_impl(blob_id, state.borrow().as_ref().unwrap())),
        Route::Logs(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().logs)),
        Route::Traces(since) => LOG_MESSAGES.with(|l| get_logs_impl(since, &l.borrow().traces)),
        Route::Metrics => RUNTIME_STATE.with(|state| get_metrics_impl(state.borrow().as_ref().unwrap())),
        _ => HttpResponse::not_found(),
    }
}

#[query]
fn http_request_streaming_callback(token: Token) -> StreamingCallbackHttpResponse {
    fn handle_request(token: Token, runtime_state: &RuntimeState) -> StreamingCallbackHttpResponse {
        continue_streaming_blob(token, &runtime_state.data.blob_storage)
    }

    RUNTIME_STATE.with(|state| handle_request(token, state.borrow().as_ref().unwrap()))
}
