use candid::{CandidType, Principal};
use ic_cdk::call::Call;
use ic_cdk::management_canister::{HttpHeader, HttpMethod, HttpRequestResult, TransformContext};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{MessageId, MessageIndex, ModerationCategories, ModerationInput};

#[derive(Serialize, Deserialize, Clone)]
pub struct PendingMessageModeration {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub attempts: u8,
}

const MODERATIONS_URL: &str = "https://api.openai.com/v1/moderations";
const MODEL: &str = "omni-moderation-latest";
const MAX_RESPONSE_BYTES: u64 = 500 * 1024;

// Classifies the given texts using the OpenAI Moderation API, returning the flagged categories
// for each input text in order.
pub async fn moderate_text_batch(api_key: &str, texts: &[String]) -> Result<Vec<ModerationCategories>, String> {
    call_moderation_api(api_key, serde_json::json!(texts)).await
}

// Classifies a single input using the OpenAI Moderation API. The text and any images are
// classified together as one combined input, so a single set of flagged categories is returned.
pub async fn moderate_input(api_key: &str, input: &ModerationInput) -> Result<ModerationCategories, String> {
    let mut parts = Vec::new();
    if let Some(text) = input.text.as_ref().filter(|t| !t.trim().is_empty()) {
        parts.push(serde_json::json!({ "type": "text", "text": text }));
    }
    for url in &input.image_urls {
        parts.push(serde_json::json!({ "type": "image_url", "image_url": { "url": url } }));
    }

    let results = call_moderation_api(api_key, serde_json::Value::Array(parts)).await?;
    results
        .into_iter()
        .next()
        .ok_or("Empty response from OpenAI Moderation API".to_string())
}

// The args accepted by the management canister's `http_request` method, including the
// `is_replicated` field which the version of ic-cdk currently in use does not yet expose.
// `is_replicated: Some(false)` makes the outcall from a single replica rather than from every
// replica on the subnet, so OpenAI receives one request per call instead of ~13. The response
// therefore needs no consensus (and no transform function). The trade-off is that the result is
// only as trustworthy as a single replica, which is acceptable here: a bad result either hides a
// message in the app store build or triggers a CSAM sanction which always alerts a human and is
// reversible.
#[derive(CandidType)]
struct HttpRequestArgs {
    url: String,
    max_response_bytes: Option<u64>,
    method: HttpMethod,
    headers: Vec<HttpHeader>,
    body: Option<Vec<u8>>,
    transform: Option<TransformContext>,
    is_replicated: Option<bool>,
}

async fn call_moderation_api(api_key: &str, input: serde_json::Value) -> Result<Vec<ModerationCategories>, String> {
    let body = serde_json::json!({
        "model": MODEL,
        "input": input,
    });

    let args = HttpRequestArgs {
        url: MODERATIONS_URL.to_string(),
        max_response_bytes: Some(MAX_RESPONSE_BYTES),
        method: HttpMethod::POST,
        headers: vec![
            HttpHeader {
                name: "content-type".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "authorization".to_string(),
                value: format!("Bearer {api_key}"),
            },
        ],
        body: Some(serde_json::to_vec(&body).unwrap()),
        transform: None,
        is_replicated: Some(false),
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
        .map_err(|error| format!("HTTPS outcall failed: {error:?}"))?
        .candid()
        .map_err(|error| format!("Failed to decode response: {error:?}"))?;

    if response.status != 200u32 {
        return Err(format!("OpenAI Moderation API returned status {}", response.status));
    }

    extract_categories(&response.body).ok_or("Failed to parse OpenAI Moderation API response".to_string())
}

fn extract_categories(body: &[u8]) -> Option<Vec<ModerationCategories>> {
    let response: ModerationsResponse = serde_json::from_slice(body).ok()?;

    Some(
        response
            .results
            .into_iter()
            .map(|result| {
                result
                    .categories
                    .into_iter()
                    .filter(|(_, flagged)| *flagged)
                    .fold(ModerationCategories::default(), |acc, (category, _)| {
                        acc | category_to_flag(&category)
                    })
            })
            .collect(),
    )
}

fn category_to_flag(category: &str) -> ModerationCategories {
    match category {
        "sexual" => ModerationCategories::SEXUAL,
        "sexual/minors" => ModerationCategories::SEXUAL_MINORS,
        "violence" => ModerationCategories::VIOLENCE,
        "violence/graphic" => ModerationCategories::VIOLENCE_GRAPHIC,
        "harassment" | "hate" => ModerationCategories::HARASSMENT,
        "harassment/threatening" | "hate/threatening" => ModerationCategories::HARASSMENT_THREATENING,
        "self-harm" | "self-harm/intent" | "self-harm/instructions" => ModerationCategories::SELF_HARM,
        "illicit" | "illicit/violent" => ModerationCategories::ILLICIT,
        _ => ModerationCategories::default(),
    }
}

#[derive(Deserialize)]
struct ModerationsResponse {
    results: Vec<ModerationResult>,
}

#[derive(Deserialize)]
struct ModerationResult {
    categories: BTreeMap<String, bool>,
}
