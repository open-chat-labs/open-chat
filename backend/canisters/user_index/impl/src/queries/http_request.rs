use crate::{read_state, RuntimeState};
use candid::Principal;
use dataurl::DataUrl;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use std::collections::BTreeMap;
use types::{HeaderField, HttpRequest, HttpResponse, TimestampMillis, UserId};
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

    fn get_bot_users(state: &RuntimeState) -> HttpResponse {
        let bots: Vec<_> = state
            .data
            .users
            .iter()
            .filter(|u| u.user_type.is_bot())
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

    fn handle_other_path(path: String, state: &RuntimeState) -> HttpResponse {
        let parts: Vec<_> = path.split('/').collect();

        match parts[0] {
            "usermetrics" => {
                let user_id: Option<UserId> = parts.get(1).and_then(|p| Principal::from_text(*p).ok()).map(|p| p.into());
                if let Some(user_id) = user_id {
                    if let Some(metrics) = state.user_metrics(user_id) {
                        return build_json_response(&metrics);
                    }
                }
            }
            "bots" => return get_bot_users(state),
            "new_users_per_day" => return get_new_users_per_day(state),
            "chitbands" => {
                let size: u32 = parts.get(1).and_then(|s| (*s).parse::<u32>().ok()).unwrap_or(500);
                let now = state.env.now();
                let month_key = MonthKey::from_timestamp(now);

                return build_json_response(&state.data.chit_bands(size, month_key.year(), month_key.month()));
            }
            "achievement_logo" => {
                let id = parts.get(1).and_then(|s| (*s).parse::<u32>().ok());
                let Some(logo) =
                    id.and_then(|achievement_id| state.data.external_achievements.get(achievement_id).map(|a| a.logo.clone()))
                else {
                    return HttpResponse::not_found();
                };

                let url = DataUrl::parse(&logo).unwrap();

                return HttpResponse {
                    status_code: 200,
                    headers: vec![
                        HeaderField("Content-Type".to_string(), url.get_media_type().to_string()),
                        HeaderField(
                            "Cache-Control".to_string(),
                            "public, max-age=100000000, immutable".to_string(),
                        ),
                    ],
                    body: url.get_data().to_vec(),
                    streaming_strategy: None,
                };
            }
            _ => (),
        }

        HttpResponse::not_found()
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) => read_state(|state| handle_other_path(path, state)),
        _ => HttpResponse::not_found(),
    }
}
