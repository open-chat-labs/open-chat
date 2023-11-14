use crate::ecdsa::get_key_id;
use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_agent::agent::EnvelopeContent;
use ic_cdk::api::management_canister::ecdsa::EcdsaKeyId;
use ic_cdk::api::management_canister::http_request::{CanisterHttpRequestArgument, HttpHeader, HttpMethod};
use ic_cdk::{query, update};
use neuron_controller_canister::manage_neuron::{Response::*, *};
use rand::Rng;
use serde::Serialize;
use utils::time::HOUR_IN_MS;

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn manage_neuron(args: Args) -> Response {
    let PrepareResult {
        envelope_content,
        request_url,
        public_key,
        key_id,
    } = mutate_state(|state| prepare(args, state));

    let body = sign_envelope(envelope_content, public_key, key_id).await.unwrap();

    ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: request_url,
            max_response_bytes: Some(1024 * 1024), // 1 MB
            method: HttpMethod::POST,
            headers: vec![HttpHeader {
                name: "content-type".to_string(),
                value: "application/cbor".to_string(),
            }],
            body: Some(body),
            transform: None,
        },
        100_000_000_000,
    )
    .await
    .unwrap();

    Success
}

#[query]
fn manage_neuron_validate(args: Args) -> Result<String, String> {
    serde_json::to_string(&args).map_err(|e| format!("Serialization error: {e:?}"))
}

struct PrepareResult {
    envelope_content: EnvelopeContent,
    request_url: String,
    public_key: Vec<u8>,
    key_id: EcdsaKeyId,
}

fn prepare(args: Args, state: &mut RuntimeState) -> PrepareResult {
    let nonce: [u8; 8] = state.env.rng().gen();
    let nns_governance_canister_id = state.data.nns_governance_canister_id;

    let envelope_content = EnvelopeContent::Call {
        nonce: Some(nonce.to_vec()),
        ingress_expiry: state.env.now_nanos() + HOUR_IN_MS * 1_000_000,
        sender: state.env.canister_id(),
        canister_id: nns_governance_canister_id,
        method_name: "manage_neuron".to_string(),
        arg: candid::encode_one(&args).unwrap(),
    };

    let ic_url = if state.data.test_mode { "http://localhost:8080/" } else { "https://icp-api.io" };

    PrepareResult {
        envelope_content,
        request_url: format!("{ic_url}/api/v2/canister/{nns_governance_canister_id}/call"),
        public_key: state.data.public_key.clone(),
        key_id: get_key_id(state.data.test_mode),
    }
}

async fn sign_envelope(content: EnvelopeContent, public_key: Vec<u8>, key_id: EcdsaKeyId) -> Result<Vec<u8>, String> {
    let signature = crate::ecdsa::sign(key_id, content.to_request_id().as_slice().try_into().unwrap())
        .await
        .unwrap();

    let envelope = Envelope {
        content,
        sender_pubkey: Some(public_key),
        sender_sig: Some(signature),
    };

    let mut serialized_bytes = Vec::new();
    let mut serializer = serde_cbor::Serializer::new(&mut serialized_bytes);
    serializer.self_describe().unwrap();
    envelope.serialize(&mut serializer).unwrap();

    Ok(serialized_bytes)
}

#[derive(Serialize)]
pub struct Envelope {
    pub content: EnvelopeContent,
    #[serde(with = "serde_bytes")]
    pub sender_pubkey: Option<Vec<u8>>,
    #[serde(with = "serde_bytes")]
    pub sender_sig: Option<Vec<u8>>,
}
