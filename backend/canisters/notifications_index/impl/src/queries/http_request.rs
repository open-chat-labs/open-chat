use crate::{RuntimeState, read_state};
use candid::Principal;
use http_request::{Route, build_json_response, encode_logs, extract_route};
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

    fn get_subscriptions_impl(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let Some(user_id) = qs.get("user_id").and_then(|u| Principal::from_text(u).ok()).map(UserId::from) else {
            return HttpResponse::not_found();
        };

        let endpoints: Vec<_> = state
            .data
            .subscriptions
            .get_by_user(&user_id)
            .into_iter()
            .map(|s| (s.added, s.endpoint))
            .collect();

        build_json_response(&endpoints)
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, qs) if path == "subscriptions" => read_state(|state| get_subscriptions_impl(qs, state)),
        _ => HttpResponse::not_found(),
    }
}
