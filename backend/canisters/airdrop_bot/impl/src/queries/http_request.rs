use crate::{RuntimeState, read_state};
use http_request::{AvatarRoute, Route, build_json_response, encode_logs, extract_route, get_document};
use ic_cdk::query;
use types::{HttpRequest, HttpResponse, TimestampMillis};

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

    fn get_admins(state: &RuntimeState) -> HttpResponse {
        let principals: Vec<_> = state.data.admins.iter().collect();

        build_json_response(&principals)
    }

    match extract_route(&request.url) {
        Route::Avatar(route) => read_state(|state| get_avatar_impl(route, state)),
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, _) if path == "admins" => read_state(get_admins),
        _ => HttpResponse::not_found(),
    }
}
