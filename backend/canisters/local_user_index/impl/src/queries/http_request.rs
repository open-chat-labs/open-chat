use crate::{RuntimeState, read_state};
use http_request::{Route, build_json_response, encode_logs, extract_route};
use ic_cdk::query;
use std::collections::HashMap;
use std::str::FromStr;
use types::{HttpRequest, HttpResponse, TimestampMillis};

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

    fn get_top_up_leaderboard(state: &RuntimeState) -> HttpResponse {
        build_json_response(&state.data.top_up_leaderboards)
    }

    fn get_remote_user_events(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let skip = qs.get("skip").and_then(|v| usize::from_str(v).ok()).unwrap_or_default();

        build_json_response(
            &state
                .data
                .events_for_remote_users
                .iter()
                .skip(skip)
                .take(1000)
                .collect::<Vec<_>>(),
        )
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, _) if p == "top_up_leaderboard" => read_state(get_top_up_leaderboard),
        Route::Other(p, qs) if p == "remote_user_events" => read_state(|state| get_remote_user_events(qs, state)),
        _ => HttpResponse::not_found(),
    }
}
