use crate::{read_state, RuntimeState};
use candid::Principal;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.metrics())
    }

    fn debug_principal(principal_str: &str, state: &RuntimeState) -> HttpResponse {
        let principal = Principal::from_text(principal_str).unwrap();
        if let Some(user) = state.data.user_principals.get_by_auth_principal(&principal) {
            build_json_response(&user.principal)
        } else if state.data.legacy_principals.contains(&principal) {
            build_json_response(&"legacy")
        } else {
            HttpResponse::not_found()
        }
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, qs) if p == "debug_principal" => {
            read_state(|state| debug_principal(qs.get("principal").unwrap(), state))
        }
        _ => HttpResponse::not_found(),
    }
}
