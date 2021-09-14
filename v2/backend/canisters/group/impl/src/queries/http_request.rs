use crate::{RuntimeState, RUNTIME_STATE};
use http_request::{http_request_impl, http_request_streaming_callback_impl};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, StreamingCallbackHttpResponse, Token};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn handle_request(request: HttpRequest, runtime_state: &RuntimeState) -> HttpResponse {
        let canister_id = runtime_state.env.canister_id();
        http_request_impl(request, canister_id, &runtime_state.data.blob_storage)
    }

    RUNTIME_STATE.with(|state| handle_request(request, state.borrow().as_ref().unwrap()))
}

#[query]
fn http_request_streaming_callback(token: Token) -> StreamingCallbackHttpResponse {
    fn handle_request(token: Token, runtime_state: &RuntimeState) -> StreamingCallbackHttpResponse {
        let canister_id = runtime_state.env.canister_id();
        http_request_streaming_callback_impl(token, canister_id, &runtime_state.data.blob_storage)
    }

    RUNTIME_STATE.with(|state| handle_request(token, state.borrow().as_ref().unwrap()))
}
