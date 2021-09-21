use crate::{RuntimeState, RUNTIME_STATE};
use http_request::{continue_streaming_blob, http_request_impl, CanisterData};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, StreamingCallbackHttpResponse, Token};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn handle_request(request: HttpRequest, runtime_state: &RuntimeState) -> HttpResponse {
        let canister_id = runtime_state.env.canister_id();
        let canister_data = CanisterData {
            blob_storage: &runtime_state.data.blob_storage,
            avatar: &runtime_state.data.avatar,
        };
        http_request_impl(request, canister_id, canister_data)
    }

    RUNTIME_STATE.with(|state| handle_request(request, state.borrow().as_ref().unwrap()))
}

#[query]
fn http_request_streaming_callback(token: Token) -> StreamingCallbackHttpResponse {
    fn handle_request(token: Token, runtime_state: &RuntimeState) -> StreamingCallbackHttpResponse {
        continue_streaming_blob(token, &runtime_state.data.blob_storage)
    }

    RUNTIME_STATE.with(|state| handle_request(token, state.borrow().as_ref().unwrap()))
}
