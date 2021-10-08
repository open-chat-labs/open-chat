use crate::{RuntimeState, LOGGER, RUNTIME_STATE};
use http_request::{continue_streaming_blob, encode_logs, extract_route, get_avatar, get_blob, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, StreamingCallbackHttpResponse, TimestampMillis, Token};
use utils::canister_logger::LogMessagesContainer;

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(requested_avatar_id: Option<u128>, runtime_state: &RuntimeState) -> HttpResponse {
        get_avatar(requested_avatar_id, &runtime_state.data.avatar)
    }

    fn get_blob_impl(blob_id: u128, runtime_state: &RuntimeState) -> HttpResponse {
        let canister_id = runtime_state.env.canister_id();
        let blob_storage = &runtime_state.data.blob_storage;
        get_blob(blob_id, canister_id, blob_storage)
    }

    fn get_logs_impl(since: Option<TimestampMillis>, messages_container: &LogMessagesContainer) -> HttpResponse {
        encode_logs(messages_container.get(since.unwrap_or(0)))
    }

    match extract_route(&request.url) {
        Route::Avatar(requested_avatar_id) => {
            RUNTIME_STATE.with(|state| get_avatar_impl(requested_avatar_id, state.borrow().as_ref().unwrap()))
        }
        Route::Blob(blob_id) => RUNTIME_STATE.with(|state| get_blob_impl(blob_id, state.borrow().as_ref().unwrap())),
        Route::Logs(since) => LOGGER.with(|c| get_logs_impl(since, c.borrow().messages_container())),
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
