use crate::model::streak::Streak;
use crate::{RuntimeState, read_state};
use http_request::{AvatarRoute, Route, build_json_response, encode_logs, extract_route, get_document};
use ic_cdk::query;
use itertools::Itertools;
use types::{ChitEarnedReason, HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(route: AvatarRoute, state: &RuntimeState) -> HttpResponse {
        get_document(route.blob_id, state.data.avatar.as_ref(), "avatar")
    }

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

    fn get_swaps(state: &RuntimeState) -> HttpResponse {
        let swaps: Vec<_> = state.data.token_swaps.iter().sorted_unstable_by_key(|s| s.started).collect();

        build_json_response(&swaps)
    }

    fn daily_claims(state: &RuntimeState) -> HttpResponse {
        let (chit_events, _) = state.data.chit_events.events(None, None, 0, 200, false);
        let claims: Vec<_> = chit_events
            .into_iter()
            .filter_map(|e| match e.reason {
                ChitEarnedReason::DailyClaim => Some((e.timestamp, 0)),
                ChitEarnedReason::DailyClaimReinstated => Some((e.timestamp, 1)),
                ChitEarnedReason::StreakInsuranceClaim => Some((e.timestamp, 2)),
                _ => None,
            })
            .map(|(ts, manual_claim)| {
                (
                    Streak::timestamp_to_offset_day(ts, state.data.streak.utc_offset_mins_at_ts(ts)),
                    manual_claim,
                )
            })
            .collect();

        build_json_response(&claims)
    }

    match extract_route(&request.url) {
        Route::Avatar(route) => read_state(|state| get_avatar_impl(route, state)),
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "swaps" => read_state(get_swaps),
        Route::Other(path, _) if path == "daily_claims" => read_state(daily_claims),
        _ => HttpResponse::not_found(),
    }
}
