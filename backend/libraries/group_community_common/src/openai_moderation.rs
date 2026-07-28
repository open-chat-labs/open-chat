use candid::Principal;
use ic_cdk::call::Call;
use ic_cdk_management_canister::{HttpHeader, HttpMethod, HttpRequestArgs, HttpRequestResult};
use serde::Deserialize;
use std::collections::BTreeMap;
use types::{ModerationCategories, ModerationInput};

const MODERATIONS_URL: &str = "https://api.openai.com/v1/moderations";
const MODEL: &str = "omni-moderation-latest";
const MAX_RESPONSE_BYTES: u64 = 500 * 1024;

// Classifies the given texts using the OpenAI Moderation API, returning the flagged categories
// for each input text in order.
pub async fn moderate_text_batch(api_key: &str, texts: &[String]) -> Result<Vec<ModerationCategories>, String> {
    let results = call_moderation_api(api_key, serde_json::json!(texts)).await?;
    if results.len() == texts.len() {
        Ok(results)
    } else {
        Err(format!(
            "OpenAI Moderation API returned {} results for {} inputs",
            results.len(),
            texts.len()
        ))
    }
}

// Classifies the text and any images of a single message using the OpenAI Moderation API,
// returning the union of the flagged categories.
//
// The text and the images are classified in separate calls rather than as one combined
// multi-modal input. If either call fails (eg. a transient error, or a blob url the API cannot
// reach) the whole item fails so that the caller retries it; re-classifying a part which
// already succeeded is harmless because flagging is idempotent.
pub async fn moderate_input(api_key: &str, input: &ModerationInput) -> Result<ModerationCategories, String> {
    let mut categories = ModerationCategories::default();

    if let Some(text) = input.text.as_ref().filter(|t| !t.trim().is_empty()) {
        for c in call_moderation_api(api_key, serde_json::json!([text])).await? {
            categories = categories | c;
        }
    }

    if !input.image_urls.is_empty() {
        let parts: Vec<_> = input
            .image_urls
            .iter()
            .map(|url| serde_json::json!({ "type": "image_url", "image_url": { "url": url } }))
            .collect();
        for c in call_moderation_api(api_key, serde_json::Value::Array(parts)).await? {
            categories = categories | c;
        }
    }

    Ok(categories)
}

async fn call_moderation_api(api_key: &str, input: serde_json::Value) -> Result<Vec<ModerationCategories>, String> {
    let body = serde_json::json!({
        "model": MODEL,
        "input": input,
    });

    // `is_replicated: Some(false)` makes the outcall from a single replica rather than from every
    // replica on the subnet, so OpenAI receives one request per call instead of ~13. The response
    // therefore needs no consensus (and no transform function). The trade-off is that the result is
    // only as trustworthy as a single replica, which is acceptable here: a bad result either hides a
    // message in the app store build or triggers a CSAM sanction which always alerts a human and is
    // reversible.
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
        _ => {
            // OpenAI may add categories over time; surface them rather than silently ignoring
            tracing::warn!(category, "Unknown OpenAI moderation category");
            ModerationCategories::default()
        }
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
