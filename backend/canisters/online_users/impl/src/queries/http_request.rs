use crate::{read_state, RuntimeState};
use candid::Principal;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use serde::Serialize;
use std::collections::HashMap;
use std::str::FromStr;
use types::{HttpRequest, HttpResponse, TimestampMillis, UserId};
use utils::time::MonthKey;

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

    fn get_minutes_online(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let now = state.env.now();
        let now_month_key = MonthKey::from_timestamp(now);

        let year = qs
            .get("year")
            .map(|y| u32::from_str(y).unwrap())
            .unwrap_or(now_month_key.year());
        let month = qs
            .get("month")
            .map(|m| u8::from_str(m).unwrap())
            .unwrap_or(now_month_key.month());
        let month_key = MonthKey::new(year, month);

        let mut user_minutes_online = Vec::new();
        if let Some(user_id) = qs.get("user_id").map(|u| UserId::from(Principal::from_text(u).unwrap())) {
            let minutes_online = state.data.user_online_minutes.get(user_id, month_key);
            user_minutes_online.push((user_id, minutes_online));
        } else {
            let mins = qs.get("mins").map(|m| u16::from_str(m).unwrap()).unwrap_or_default();
            user_minutes_online.extend(state.data.user_online_minutes.get_all_filtered(month_key, mins));
        }

        let total = user_minutes_online.len() as u32;
        user_minutes_online.truncate(1000);

        build_json_response(&UserOnlineMinutes {
            total,
            users: user_minutes_online,
        })
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(p, qs) if p == "minutes_online" => read_state(|state| get_minutes_online(qs, state)),
        _ => HttpResponse::not_found(),
    }
}

#[derive(Serialize)]
struct UserOnlineMinutes {
    total: u32,
    users: Vec<(UserId, u16)>,
}
