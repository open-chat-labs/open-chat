use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister::ecdsa::{EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument, SignWithEcdsaArgument};
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, TransformContext, TransformFunc,
};
use ic_transport_types::{to_request_id, EnvelopeContent};
use serde::Serialize;
use sha256::sha256;
use tracing::{error, info};
use types::CanisterId;

pub fn get_key_id(is_local_dev_mode: bool) -> EcdsaKeyId {
    let key_name = if is_local_dev_mode { "dfx_test_key" } else { "key_1" };

    EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: key_name.to_string(),
    }
}

pub async fn get_public_key(key_id: EcdsaKeyId) -> CallResult<Vec<u8>> {
    match ic_cdk::api::management_canister::ecdsa::ecdsa_public_key(EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path: Vec::new(),
        key_id,
    })
    .await
    {
        Ok(res) => Ok(res.0.public_key),
        Err(error) => {
            error!(?error, "Error calling 'ecdsa_public_key'");
            Err(error)
        }
    }
}

pub struct CanisterEcdsaRequest {
    pub envelope_content: EnvelopeContent,
    pub request_url: String,
    pub public_key: Vec<u8>,
    pub key_id: EcdsaKeyId,
    pub this_canister_id: CanisterId,
}

pub async fn make_canister_call_via_ecdsa(request: CanisterEcdsaRequest) -> Result<String, String> {
    let body = match sign_envelope(request.envelope_content, request.public_key, request.key_id).await {
        Ok(bytes) => bytes,
        Err(error) => return Err(format!("Failed to sign envelope: {error:?}")),
    };

    let (response,) = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: request.request_url,
            max_response_bytes: Some(1024 * 1024), // 1 MB
            method: HttpMethod::POST,
            headers: vec![HttpHeader {
                name: "content-type".to_string(),
                value: "application/cbor".to_string(),
            }],
            body: Some(body),
            transform: Some(TransformContext {
                function: TransformFunc::new(request.this_canister_id, "transform_http_response".to_string()),
                context: Vec::new(),
            }),
        },
        100_000_000_000,
    )
    .await
    .map_err(|error| format!("Failed to make http request: {error:?}"))?;

    Ok(String::from_utf8(response.body).unwrap())
}

async fn sign_envelope(content: EnvelopeContent, public_key: Vec<u8>, key_id: EcdsaKeyId) -> CallResult<Vec<u8>> {
    let request_id = to_request_id(&content).unwrap();

    let signature = sign(key_id, &request_id.signable()).await?;

    let envelope = Envelope {
        content: content.clone(),
        sender_pubkey: Some(public_key),
        sender_sig: Some(signature.clone()),
    };

    let mut serialized_bytes = Vec::new();
    let mut serializer = serde_cbor::Serializer::new(&mut serialized_bytes);
    serializer.self_describe().unwrap();
    envelope.serialize(&mut serializer).unwrap();

    info!(
        request_id = String::from(request_id),
        signature = hex::encode(signature),
        "Signed envelope"
    );

    Ok(serialized_bytes)
}

async fn sign(key_id: EcdsaKeyId, message: &[u8]) -> CallResult<Vec<u8>> {
    let message_hash = sha256(message);

    match ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa(SignWithEcdsaArgument {
        message_hash: message_hash.to_vec(),
        derivation_path: Vec::new(),
        key_id,
    })
    .await
    {
        Ok(res) => Ok(res.0.signature),
        Err(error) => {
            error!(?error, "Error calling 'sign_with_ecdsa'");
            Err(error)
        }
    }
}

#[derive(Serialize)]
struct Envelope {
    content: EnvelopeContent,
    #[serde(with = "serde_bytes")]
    sender_pubkey: Option<Vec<u8>>,
    #[serde(with = "serde_bytes")]
    sender_sig: Option<Vec<u8>>,
}
