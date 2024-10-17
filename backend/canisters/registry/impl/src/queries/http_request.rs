use crate::{read_state, RuntimeState};
use dataurl::DataUrl;
use http_request::{build_json_response, encode_logs, extract_route, Route};
use ic_cdk::query;
use std::collections::HashMap;
use std::str::FromStr;
use types::{CanisterId, HeaderField, HttpRequest, HttpResponse, TimestampMillis};
use utils::format::format_to_decimal_places;

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

    fn get_logo(qs: HashMap<String, String>, state: &RuntimeState) -> HttpResponse {
        let Some(token) = qs
            .get("ledger")
            .and_then(|l| CanisterId::from_text(l).ok())
            .and_then(|l| state.data.tokens.get(l))
        else {
            return HttpResponse::not_found();
        };

        // If the token logo is no longer a data url, forward caller to the logo url
        let Some(logo_id) = token.logo_id else {
            return HttpResponse::moved_temporarily(&token.logo, Some(3600));
        };

        let url = DataUrl::parse(&token.logo).unwrap();
        let requested_id = qs.get("id").and_then(|id| u128::from_str(id).ok());

        if requested_id == token.logo_id {
            HttpResponse {
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
            }
        } else {
            let ledger = token.ledger_canister_id;

            // If the requested id doesn't match the logo id, forward the caller to the url for the current id.
            HttpResponse::moved_permanently(&format!("/logo?ledger={ledger}&id={logo_id}"))
        }
    }

    fn get_total_supply(state: &RuntimeState) -> HttpResponse {
        build_chat_amount_response(state.data.total_supply.value)
    }

    fn get_circulating_supply(state: &RuntimeState) -> HttpResponse {
        build_chat_amount_response(state.data.circulating_supply.value)
    }

    fn build_chat_amount_response(e8s: u128) -> HttpResponse {
        let formatted = format_to_decimal_places(e8s as f64 / 100_000_000.0, 8);
        let body = formatted.into_bytes();

        HttpResponse {
            status_code: 200,
            headers: vec![
                HeaderField("content-type".to_string(), "application/json".to_string()),
                HeaderField("content-length".to_string(), body.len().to_string()),
            ],
            body,
            streaming_strategy: None,
        }
    }

    match extract_route(&request.url) {
        Route::Errors(since) => get_errors_impl(since),
        Route::Logs(since) => get_logs_impl(since),
        Route::Traces(since) => get_traces_impl(since),
        Route::Metrics => read_state(get_metrics_impl),
        Route::Other(path, qs) if path == "logo" => read_state(|state| get_logo(qs, state)),
        Route::Other(path, _) if path == "total_supply" => read_state(get_total_supply),
        Route::Other(path, _) if path == "circulating_supply" => read_state(get_circulating_supply),
        _ => HttpResponse::not_found(),
    }
}
