use crate::{read_state, RuntimeState};
use http_request::{build_json_response, build_response, encode_logs, extract_route, get_avatar, Route};
use ic_cdk_macros::query;
use ledger_utils::default_ledger_account;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(requested_avatar_id: Option<u128>, runtime_state: &RuntimeState) -> HttpResponse {
        get_avatar(requested_avatar_id, &runtime_state.data.avatar)
    }

    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        build_json_response(&runtime_state.metrics())
    }

    fn get_ledger_account_impl(runtime_state: &RuntimeState) -> HttpResponse {
        let ledger_account = default_ledger_account(runtime_state.env.canister_id()).to_string();
        let body = ledger_account.into_bytes();

        build_response(body, "text/plain")
    }

    match extract_route(&request.url) {
        Route::Avatar(requested_avatar_id) => read_state(|state| get_avatar_impl(requested_avatar_id, state)),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "ledger_account" => read_state(get_ledger_account_impl),
        _ => HttpResponse::not_found(),
    }
}
