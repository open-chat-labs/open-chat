use crate::model::user_referral_leaderboards::MonthKey;
use crate::{read_state, RuntimeState};
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use querystring::{querify, QueryParams};
use std::str::FromStr;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    fn get_logs_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_logs(), since.unwrap_or(0))
    }

    fn get_traces_impl(since: Option<TimestampMillis>) -> HttpResponse {
        encode_logs(canister_logger::export_traces(), since.unwrap_or(0))
    }

    fn get_metrics_impl(runtime_state: &RuntimeState) -> HttpResponse {
        build_json_response(&runtime_state.metrics())
    }

    fn user_referral_leaderboard(
        year: Option<u32>,
        month: Option<u32>,
        count: Option<usize>,
        runtime_state: &RuntimeState,
    ) -> HttpResponse {
        let key = if let Some((y, n)) = year.and_then(|y| month.map(|m| (y, m))) {
            MonthKey::new(y, n)
        } else {
            let now = runtime_state.env.now();
            MonthKey::from_timestamp(now)
        };

        let top = runtime_state
            .data
            .user_referral_leaderboards
            .top_for_month(key, count.unwrap_or(50));

        build_json_response(&top)
    }

    fn user_referral_leaderboard_all_time(count: Option<usize>, runtime_state: &RuntimeState) -> HttpResponse {
        let top = runtime_state
            .data
            .user_referral_leaderboards
            .top_all_time(count.unwrap_or(50));

        build_json_response(&top)
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, qs) if p == "user_referral_leaderboard" => {
            let params = querify(&qs);
            let year = extract_qs_param(&params, "year");
            let month = extract_qs_param(&params, "month");
            let count = extract_qs_param(&params, "count");

            read_state(|state| user_referral_leaderboard(year, month, count, state))
        }
        Route::Other(p, qs) if p == "user_referral_leaderboard_all_time" => {
            let params = querify(&qs);
            let count = extract_qs_param(&params, "count");
            read_state(|state| user_referral_leaderboard_all_time(count, state))
        }
        _ => HttpResponse::not_found(),
    }
}

fn extract_qs_param<T: FromStr>(params: &QueryParams, name: &str) -> Option<T> {
    params.iter().find(|(k, _)| *k == name).and_then(|(_, v)| T::from_str(v).ok())
}
