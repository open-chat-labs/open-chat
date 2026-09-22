use crate::{RuntimeState, read_state};
use http_request::{AvatarRoute, Route, build_json_response, encode_logs, extract_route, get_document};
use ic_cdk::query;
use itertools::Itertools;
use stable_memory_map::ProfileDocumentType;
use types::{ChitEventType, HttpRequest, HttpResponse, TimestampMillis};
use user_state::Streak;

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_avatar_impl(route: AvatarRoute, state: &RuntimeState) -> HttpResponse {
        get_document(
            route.blob_id,
            state.data.user.avatar.get(ProfileDocumentType::Avatar).as_ref(),
            "avatar",
        )
    }

    fn get_profile_background_impl(id: Option<u128>, state: &RuntimeState) -> HttpResponse {
        get_document(
            id,
            state
                .data
                .user
                .profile_background
                .get(ProfileDocumentType::ProfileBackground)
                .as_ref(),
            "profile_background",
        )
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
        let swaps: Vec<_> = state
            .data
            .user
            .token_swaps
            .all()
            .into_iter()
            .sorted_unstable_by_key(|s| s.started)
            .collect();

        build_json_response(&swaps)
    }

    fn daily_claims(state: &RuntimeState) -> HttpResponse {
        let (chit_events, _) = state.data.user.chit_events.events(None, None, 0, 500, false);
        let claims: Vec<_> = chit_events
            .into_iter()
            .filter_map(|e| match e.reason {
                ChitEventType::DailyClaim => Some((e.timestamp, 0)),
                ChitEventType::DailyClaimReinstated => Some((e.timestamp, 1)),
                ChitEventType::StreakInsuranceClaim => Some((e.timestamp, 2)),
                _ => None,
            })
            .map(|(ts, claim_type)| {
                let offset = state.data.user.streak.utc_offset_mins_at_ts(ts);
                (Streak::timestamp_to_offset_day(ts, offset), claim_type, ts, offset)
            })
            .collect();

        build_json_response(&claims)
    }

    match extract_route(&request.url) {
        Route::Avatar(route) => read_state(|state| get_avatar_impl(route, state)),
        Route::ProfileBackground(id) => read_state(|state| get_profile_background_impl(id, state)),
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "swaps" => read_state(get_swaps),
        Route::Other(path, _) if path == "daily_claims" => read_state(daily_claims),
        _ => HttpResponse::not_found(),
    }
}
