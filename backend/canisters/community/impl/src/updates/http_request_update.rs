use crate::updates::handle_webhook;
use http_request::{Route, WebhookRoute, build_json_response, extract_route};
use ic_cdk::update;
use types::{HttpRequest, HttpResponse};

#[update]
fn http_request_update(request: HttpRequest) -> HttpResponse {
    fn handle_webhook(route: WebhookRoute, body: Vec<u8>) -> HttpResponse {
        let Some(message) = String::from_utf8(body).ok() else {
            return HttpResponse::bad_request("Invalid UTF-8");
        };

        let Some(channel_id) = route.channel_id else {
            return HttpResponse::bad_request("Channel ID missing from webhook route");
        };

        let response = handle_webhook::handle_webhook(community_canister::handle_webhook::Args {
            channel_id,
            id: route.webhook_id,
            secret: route.secret,
            message,
        });

        build_json_response(&response)
    }

    match extract_route(&request.url) {
        Route::Webhook(route) => handle_webhook(route, request.body),
        _ => HttpResponse::not_found(),
    }
}
