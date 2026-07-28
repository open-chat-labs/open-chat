use candid::{CandidType, Principal};
use ic_cdk::call::Call;
use ic_cdk::management_canister::{HttpHeader, HttpMethod, HttpRequestResult, TransformContext};
use serde::Deserialize;
use std::collections::BTreeMap;
use types::{ModerationCategories, ModerationInput, ModerationReferralConfig};

const MODERATIONS_URL: &str = "https://api.openai.com/v1/moderations";
const MODEL: &str = "omni-moderation-latest";
const MAX_RESPONSE_BYTES: u64 = 500 * 1024;

// A single input's classification: the categories the API flagged, plus the categories which
// scored above the caller's moderation-referral threshold (always empty when no referral
// config is given)
#[derive(Clone, Copy, Debug, Default)]
pub struct Classification {
    pub flagged: ModerationCategories,
    pub moderation_referral: ModerationCategories,
}

// Classifies the given texts using the OpenAI Moderation API, returning the flagged categories
// for each input text in order.
pub async fn moderate_text_batch(api_key: &str, texts: &[String]) -> Result<Vec<ModerationCategories>, String> {
    Ok(classify_text_batch(api_key, texts, None)
        .await?
        .into_iter()
        .map(|c| c.flagged)
        .collect())
}

pub async fn classify_text_batch(
    api_key: &str,
    texts: &[String],
    moderation_referral: Option<&ModerationReferralConfig>,
) -> Result<Vec<Classification>, String> {
    let results = call_moderation_api(api_key, serde_json::json!(texts), moderation_referral).await?;
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
    Ok(classify_input(api_key, input, None).await?.flagged)
}

pub async fn classify_input(
    api_key: &str,
    input: &ModerationInput,
    moderation_referral: Option<&ModerationReferralConfig>,
) -> Result<Classification, String> {
    let mut classification = Classification::default();

    if let Some(text) = input.text.as_ref().filter(|t| !t.trim().is_empty()) {
        for c in call_moderation_api(api_key, serde_json::json!([text]), moderation_referral).await? {
            classification.flagged = classification.flagged | c.flagged;
            classification.moderation_referral = classification.moderation_referral | c.moderation_referral;
        }
    }

    if !input.image_urls.is_empty() {
        let parts: Vec<_> = input
            .image_urls
            .iter()
            .map(|url| serde_json::json!({ "type": "image_url", "image_url": { "url": url } }))
            .collect();
        for c in call_moderation_api(api_key, serde_json::Value::Array(parts), moderation_referral).await? {
            classification.flagged = classification.flagged | c.flagged;
            classification.moderation_referral = classification.moderation_referral | c.moderation_referral;
        }
    }

    Ok(classification)
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

async fn call_moderation_api(
    api_key: &str,
    input: serde_json::Value,
    moderation_referral: Option<&ModerationReferralConfig>,
) -> Result<Vec<Classification>, String> {
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

    extract_classifications(&response.body, moderation_referral)
        .ok_or("Failed to parse OpenAI Moderation API response".to_string())
}

fn extract_classifications(body: &[u8], moderation_referral: Option<&ModerationReferralConfig>) -> Option<Vec<Classification>> {
    let response: ModerationsResponse = serde_json::from_slice(body).ok()?;

    Some(
        response
            .results
            .into_iter()
            .map(|result| {
                let flagged = result
                    .categories
                    .into_iter()
                    .filter(|(_, flagged)| *flagged)
                    .fold(ModerationCategories::default(), |acc, (category, _)| {
                        acc | category_to_flag(&category)
                    });

                // Referral is score-based rather than reusing the API's flagged booleans so
                // that each category's threshold can be tuned independently of the API's own,
                // keeping borderline content out of the human review queue
                let moderation_referral_categories = moderation_referral
                    .map(|config| {
                        result
                            .category_scores
                            .iter()
                            .fold(ModerationCategories::default(), |acc, (category, score)| {
                                let bit = category_to_flag(category).bits();
                                let referred = config
                                    .categories
                                    .iter()
                                    .any(|c| c.category == bit && *score >= c.score_threshold);
                                if referred { acc | category_to_flag(category) } else { acc }
                            })
                            .bits()
                            & !ModerationCategories::SEXUAL_MINORS.bits()
                    })
                    .and_then(ModerationCategories::from_bits)
                    .unwrap_or_default();

                Classification {
                    flagged,
                    moderation_referral: moderation_referral_categories,
                }
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
    #[serde(default)]
    category_scores: BTreeMap<String, f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(categories: &[(&str, bool)], scores: &[(&str, f64)]) -> Vec<u8> {
        let categories: serde_json::Map<String, serde_json::Value> = categories
            .iter()
            .map(|(c, f)| (c.to_string(), serde_json::json!(f)))
            .collect();
        let scores: serde_json::Map<String, serde_json::Value> =
            scores.iter().map(|(c, v)| (c.to_string(), serde_json::json!(v))).collect();
        serde_json::to_vec(&serde_json::json!({
            "results": [{ "categories": categories, "category_scores": scores }]
        }))
        .unwrap()
    }

    fn config(categories: u32, score_threshold: f64) -> ModerationReferralConfig {
        ModerationReferralConfig {
            categories: (0..32)
                .map(|i| 1u32 << i)
                .filter(|bit| categories & bit != 0)
                .map(|category| types::ModerationReferralCategory {
                    category,
                    score_threshold,
                })
                .collect(),
        }
    }

    #[test]
    fn flagged_categories_map_to_bits() {
        let body = body(&[("sexual", true), ("violence", true), ("self-harm", false)], &[]);
        let result = extract_classifications(&body, None).unwrap();
        assert_eq!(
            result[0].flagged.bits(),
            (ModerationCategories::SEXUAL | ModerationCategories::VIOLENCE).bits()
        );
        assert!(result[0].moderation_referral.is_empty());
    }

    #[test]
    fn referral_is_score_based_not_flag_based() {
        // Flagged but below the referral threshold: no referral. Unflagged but above: referral.
        let body = body(
            &[("sexual", true), ("harassment", false)],
            &[("sexual", 0.7), ("harassment", 0.96)],
        );
        let cfg = config((ModerationCategories::SEXUAL | ModerationCategories::HARASSMENT).bits(), 0.9);
        let result = extract_classifications(&body, Some(&cfg)).unwrap();
        assert_eq!(result[0].moderation_referral.bits(), ModerationCategories::HARASSMENT.bits());
    }

    #[test]
    fn per_category_thresholds_apply_independently() {
        let body = body(&[], &[("sexual", 0.86), ("violence", 0.86)]);
        let cfg = ModerationReferralConfig {
            categories: vec![
                types::ModerationReferralCategory {
                    category: ModerationCategories::SEXUAL.bits(),
                    score_threshold: 0.85,
                },
                types::ModerationReferralCategory {
                    category: ModerationCategories::VIOLENCE.bits(),
                    score_threshold: 0.95,
                },
            ],
        };
        let result = extract_classifications(&body, Some(&cfg)).unwrap();
        assert_eq!(result[0].moderation_referral.bits(), ModerationCategories::SEXUAL.bits());
    }

    #[test]
    fn sexual_minors_never_becomes_a_referral() {
        // Even a malformed config containing the CSAM bit cannot demote it to referral
        let body = body(&[("sexual/minors", true)], &[("sexual/minors", 0.99)]);
        let cfg = config(ModerationCategories::SEXUAL_MINORS.bits(), 0.5);
        let result = extract_classifications(&body, Some(&cfg)).unwrap();
        assert!(result[0].moderation_referral.is_empty());
        // But it is still flagged - the CSAM auto-sanction path sees it
        assert!(result[0].flagged.contains(ModerationCategories::SEXUAL_MINORS));
    }

    #[test]
    fn unknown_categories_are_ignored() {
        let body = body(&[("some-new-category", true), ("sexual", true)], &[]);
        let result = extract_classifications(&body, None).unwrap();
        assert_eq!(result[0].flagged.bits(), ModerationCategories::SEXUAL.bits());
    }

    #[test]
    fn missing_scores_mean_no_referral() {
        // omni responses without category_scores (or malformed) must not panic
        let body = serde_json::to_vec(&serde_json::json!({
            "results": [{ "categories": { "sexual": true } }]
        }))
        .unwrap();
        let cfg = config(ModerationCategories::SEXUAL.bits(), 0.5);
        let result = extract_classifications(&body, Some(&cfg)).unwrap();
        assert!(result[0].moderation_referral.is_empty());
        assert!(result[0].flagged.contains(ModerationCategories::SEXUAL));
    }
}
