use crate::{read_state, RuntimeState};
use candid::Principal;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use std::collections::HashMap;
use types::{HttpRequest, HttpResponse, TimestampMillis, UserId};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_errors_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_errors(), since.unwrap_or(0))
    }

    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    fn get_originating_canisters(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let user_id: UserId = qs.get("user_id").map(|u| Principal::from_text(u).unwrap()).unwrap().into();

        let auth_principals = state.data.user_principals.get_originating_canisters_by_user_id_slow(user_id);

        build_json_response(&auth_principals)
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, qs) if path == "originating_canisters" => read_state(|state| get_originating_canisters(qs, state)),
        _ => HttpResponse::not_found(),
    }
}
