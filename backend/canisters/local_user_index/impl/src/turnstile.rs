use candid::Principal;
use ic_cdk::call::Call;
use ic_cdk_management_canister::{HttpHeader, HttpMethod, HttpRequestArgs, HttpRequestResult};
use oc_error_codes::{OCError, OCErrorCode};
use serde::Deserialize;
use types::{MessageId, UserId};

const SITEVERIFY_URL: &str = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_RESPONSE_BYTES: u64 = 4 * 1024;
// The widget's action, so that a token issued for anything else is refused
const ACTION: &str = "claim_prize";

// The custom data the website gives the widget, so that a token only serves this user's claim of
// this prize. Cloudflare allows up to 255 characters of [A-Za-z0-9_-].
pub fn custom_data(user_id: UserId, message_id: MessageId) -> String {
    format!("{user_id}_{message_id}")
}

// Asks Cloudflare whether the token shows a human, then that it was issued for this claim.
//
// A token can only be redeemed once, so the outcall is made from a single replica: a replicated
// outcall would send it from every replica, all but the first of which would be told it was
// already used, and they would never agree. The result is only as trustworthy as one replica,
// which is acceptable here: a lying replica could at worst let a claim skip the check.
pub async fn verify(secret_key: &str, token: &str, expected_custom_data: &str) -> Result<(), OCError> {
    let body = serde_json::json!({
        "secret": secret_key,
        "response": token,
    });

    let args = HttpRequestArgs {
        url: SITEVERIFY_URL.to_string(),
        max_response_bytes: Some(MAX_RESPONSE_BYTES),
        method: HttpMethod::POST,
        headers: vec![HttpHeader {
            name: "content-type".to_string(),
            value: "application/json".to_string(),
        }],
        body: Some(serde_json::to_vec(&body).unwrap()),
        transform: None,
        is_replicated: Some(false),
        // The legacy pricing model, which is what `cost_http_request` prices below
        pricing_version: Some(1),
    };

    // This computes the cost of a fully replicated call which is an overestimate for a
    // single-replica call, but any excess is refunded
    let request_size = (args.url.len()
        + args.headers.iter().map(|h| h.name.len() + h.value.len()).sum::<usize>()
        + args.body.as_ref().map_or(0, |b| b.len())) as u64;
    let cycles = ic_cdk::api::cost_http_request(request_size, MAX_RESPONSE_BYTES);

    let response: HttpRequestResult = Call::unbounded_wait(Principal::management_canister(), "http_request")
        .with_arg(&args)
        .with_cycles(cycles)
        .await
        .map_err(|error| OCErrorCode::HumanVerificationFailed.with_message(format!("HTTPS outcall failed: {error:?}")))?
        .candid()
        .map_err(|error| {
            OCErrorCode::HumanVerificationFailed.with_message(format!("Failed to decode outcall response: {error:?}"))
        })?;

    let status = u32::try_from(response.status.0).unwrap_or_default();
    if status != 200 {
        return Err(OCErrorCode::HumanVerificationFailed.with_message(format!("Siteverify returned status {status}")));
    }

    check(&response.body, expected_custom_data).map_err(|reason| OCErrorCode::HumanVerificationFailed.with_message(reason))
}

#[derive(Deserialize)]
struct SiteverifyResponse {
    success: bool,
    action: Option<String>,
    cdata: Option<String>,
    #[serde(default, rename = "error-codes")]
    error_codes: Vec<String>,
    metadata: Option<SiteverifyMetadata>,
}

#[derive(Deserialize)]
struct SiteverifyMetadata {
    #[serde(default)]
    result_with_testing_key: bool,
}

fn check(body: &[u8], expected_custom_data: &str) -> Result<(), String> {
    let response: SiteverifyResponse =
        serde_json::from_slice(body).map_err(|error| format!("Failed to parse siteverify response: {error}"))?;

    if !response.success {
        return Err(format!("Token rejected: {:?}", response.error_codes));
    }
    // Cloudflare's testing keys pass every token and report neither the action nor the custom data
    if response.metadata.is_some_and(|m| m.result_with_testing_key) {
        return Ok(());
    }
    if response.action.as_deref() != Some(ACTION) {
        return Err(format!("Token issued for action {:?}", response.action));
    }
    if response.cdata.as_deref() != Some(expected_custom_data) {
        return Err(format!("Token issued for custom data {:?}", response.cdata));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CUSTOM_DATA: &str = "46qm5-fiaaa-aaaaf-br7x6-xca_12525619536623022000";

    #[test]
    fn passes_a_token_issued_for_this_claim() {
        let body = format!(
            r#"{{"success":true,"challenge_ts":"2026-11-04T15:00:00.000Z","hostname":"oc.app","error-codes":[],"action":"claim_prize","cdata":"{CUSTOM_DATA}","metadata":{{"ephemeral_id":"x:abc"}}}}"#
        );
        assert_eq!(check(body.as_bytes(), CUSTOM_DATA), Ok(()));
    }

    #[test]
    fn refuses_a_rejected_token() {
        let body = r#"{"success":false,"error-codes":["timeout-or-duplicate"],"messages":[]}"#;
        assert!(
            check(body.as_bytes(), CUSTOM_DATA)
                .unwrap_err()
                .contains("timeout-or-duplicate")
        );
    }

    #[test]
    fn refuses_a_token_issued_for_another_claim() {
        let body = r#"{"success":true,"action":"claim_prize","cdata":"46qm5-fiaaa-aaaaf-br7x6-xca_1"}"#;
        assert!(check(body.as_bytes(), CUSTOM_DATA).is_err());
    }

    #[test]
    fn refuses_a_token_issued_for_another_action() {
        let body = format!(r#"{{"success":true,"action":"login","cdata":"{CUSTOM_DATA}"}}"#);
        assert!(check(body.as_bytes(), CUSTOM_DATA).is_err());
    }

    #[test]
    fn passes_a_testing_key_token_without_action_or_custom_data() {
        let body = r#"{"success":true,"error-codes":[],"metadata":{"result_with_testing_key":true}}"#;
        assert_eq!(check(body.as_bytes(), CUSTOM_DATA), Ok(()));
    }

    #[test]
    fn custom_data_joins_the_user_and_message() {
        let user_id = UserId::from(Principal::from_text("46qm5-fiaaa-aaaaf-br7x6-xca").unwrap());
        let message_id = MessageId::from(12525619536623022000u128);
        assert_eq!(custom_data(user_id, message_id), CUSTOM_DATA);
    }
}
