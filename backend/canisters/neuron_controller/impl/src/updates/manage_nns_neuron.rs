use crate::ecdsa::{get_key_id, sign_envelope};
use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::ecdsa::EcdsaKeyId;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext, TransformFunc,
};
use ic_cdk::query;
use ic_transport_types::EnvelopeContent;
use neuron_controller_canister::manage_nns_neuron::{Response::*, *};
use nns_governance_canister::types::manage_neuron::Command;
use nns_governance_canister::types::ManageNeuron;
use rand::Rng;
use types::CanisterId;
use utils::time::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};

const IC_URL: &str = "https://icp-api.io";

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn manage_nns_neuron(args: Args) -> Response {
    manage_nns_neuron_impl(args.neuron_id, args.command).await
}

pub(crate) async fn manage_nns_neuron_impl(neuron_id: u64, command: Command) -> Response {
    let PrepareResult {
        envelope_content,
        request_url,
        public_key,
        key_id,
        this_canister_id,
    } = mutate_state(|state| prepare(neuron_id, command, state));

    let body = match sign_envelope(envelope_content, public_key, key_id).await {
        Ok(bytes) => bytes,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let (response,) = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: request_url,
            max_response_bytes: Some(1024 * 1024), // 1 MB
            method: HttpMethod::POST,
            headers: vec![HttpHeader {
                name: "content-type".to_string(),
                value: "application/cbor".to_string(),
            }],
            body: Some(body),
            transform: Some(TransformContext {
                function: TransformFunc::new(this_canister_id, "transform_response".to_string()),
                context: Vec::new(),
            }),
        },
        100_000_000_000,
    )
    .await
    .unwrap();

    Success(String::from_utf8(response.body).unwrap())
}

#[query]
fn transform_response(args: TransformArgs) -> HttpResponse {
    let mut response = args.response;
    response.headers.clear();
    response
}

struct PrepareResult {
    envelope_content: EnvelopeContent,
    request_url: String,
    public_key: Vec<u8>,
    key_id: EcdsaKeyId,
    this_canister_id: CanisterId,
}

fn prepare(neuron_id: u64, command: Command, state: &mut RuntimeState) -> PrepareResult {
    let nonce: [u8; 8] = state.env.rng().gen();
    let nns_governance_canister_id = state.data.nns_governance_canister_id;

    let envelope_content = EnvelopeContent::Call {
        nonce: Some(nonce.to_vec()),
        ingress_expiry: state.env.now_nanos() + 5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND,
        sender: state.data.get_principal(),
        canister_id: nns_governance_canister_id,
        method_name: "manage_neuron".to_string(),
        arg: candid::encode_one(ManageNeuron::new(neuron_id, command)).unwrap(),
    };

    PrepareResult {
        envelope_content,
        request_url: format!("{IC_URL}/api/v2/canister/{nns_governance_canister_id}/call"),
        public_key: state.data.get_public_key_der(),
        key_id: get_key_id(false),
        this_canister_id: state.env.canister_id(),
    }
}
