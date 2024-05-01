use crate::{read_state, RuntimeState};
use candid::Principal;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk_macros::query;
use std::collections::BTreeMap;
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

    fn get_bot_users(state: &RuntimeState) -> HttpResponse {
        let bots: Vec<_> = state
            .data
            .users
            .iter()
            .filter(|u| u.is_bot)
            .map(|u| (u.user_id.to_string(), u.username.clone()))
            .collect();

        build_json_response(&bots)
    }

    fn get_new_users_per_day(state: &RuntimeState) -> HttpResponse {
        let mut grouped: BTreeMap<String, u32> = BTreeMap::new();
        for user in state.data.users.iter().filter(|u| u.date_created > 0) {
            let date = time::OffsetDateTime::from_unix_timestamp((user.date_created / 1000) as i64).unwrap();
            let date_string = format!("{}-{:02}-{:02}", date.year(), u8::from(date.month()), date.day());
            *grouped.entry(date_string).or_default() += 1;
        }
        build_json_response(&grouped)
    }

    fn debug_principal_migration(principal_str: &str, state: &RuntimeState) -> HttpResponse {
        let principal = Principal::from_text(principal_str).unwrap();
        if let Some(user) = state.data.users.get(&principal) {
            build_json_response(&(user.user_id, user.principal, user.principal_migrated))
        } else {
            HttpResponse::not_found()
        }
    }

    match extract_route(&request.url) {
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "bots" => read_state(get_bot_users),
        Route::Other(path, _) if path == "new_users_per_day" => read_state(get_new_users_per_day),
        Route::Other(path, qs) if path == "debug_principal_migration" => {
            read_state(|state| debug_principal_migration(qs.get("user_id").unwrap(), state))
        }
        _ => HttpResponse::not_found(),
    }
}
