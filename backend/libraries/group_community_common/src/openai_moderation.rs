use ic_cdk::management_canister::{self, HttpHeader, HttpMethod, HttpRequestArgs, HttpRequestResult};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{MessageId, MessageIndex, ModerationCategories};

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
pub async fn moderate(api_key: &str, texts: &[String]) -> Result<Vec<ModerationCategories>, String> {
    let body = serde_json::json!({
        "model": MODEL,
        "input": texts,
    });

    let response = management_canister::http_request_with_closure(
        &HttpRequestArgs {
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
        },
        transform_response,
    )
    .await
    .map_err(|error| format!("HTTPS outcall failed: {error:?}"))?;

    if response.status != 200u32 {
        return Err(format!("OpenAI Moderation API returned status {}", response.status));
    }

    let bits: Vec<u32> =
        serde_json::from_slice(&response.body).map_err(|error| format!("Failed to parse response: {error}"))?;

    Ok(bits
        .into_iter()
        .map(|b| ModerationCategories::from_bits(b).unwrap_or_default())
        .collect())
}

// Reduces the response to the minimal deterministic form needed for consensus across replicas:
// one bitfield of flagged categories per input text.
fn transform_response(mut response: HttpRequestResult) -> HttpRequestResult {
    response.headers.clear();
    response.body = extract_category_bits(&response.body)
        .map(|bits| serde_json::to_vec(&bits).unwrap())
        .unwrap_or_default();
    response
}

fn extract_category_bits(body: &[u8]) -> Option<Vec<u32>> {
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
                    .bits()
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
