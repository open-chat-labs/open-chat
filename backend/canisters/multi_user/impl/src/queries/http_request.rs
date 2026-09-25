use crate::{RuntimeState, read_state};
use http_request::{Route, UserRoute, build_json_response, encode_logs, extract_route, get_document};
use ic_cdk::query;
use stable_memory_map::ProfileDocumentType;
use types::{HttpRequest, HttpResponse, TimestampMillis};

#[query]
fn http_request(request: HttpRequest) -> HttpResponse {
    // Serves the document of the user at `user_index`, as the User canister serves its own user's
    // but under `/user/{user_index}`, so that a redirect to the document's latest id keeps it
    fn get_user_document_impl(user_index: u16, route: UserRoute, state: &RuntimeState) -> HttpResponse {
        state
            .data
            .users
            .with_user(user_index, |user| match route {
                UserRoute::Avatar(id) => get_document(
                    id,
                    user.avatar.get(ProfileDocumentType::Avatar).as_ref(),
                    &format!("user/{user_index}/avatar"),
                ),
                UserRoute::ProfileBackground(id) => get_document(
                    id,
                    user.profile_background.get(ProfileDocumentType::ProfileBackground).as_ref(),
                    &format!("user/{user_index}/profile_background"),
                ),
            })
            .unwrap_or_else(HttpResponse::not_found)
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

    match extract_route(&request.url) {
        Route::User(user_index, route) => read_state(|state| get_user_document_impl(user_index, route, state)),
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        _ => HttpResponse::not_found(),
    }
}
