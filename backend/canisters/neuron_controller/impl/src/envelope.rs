use candid::Principal;
use ic_cdk::api::management_canister::ecdsa::EcdsaKeyId;
use ic_transport_types::to_request_id;
use serde::{Deserialize, Serialize};

pub async fn sign_envelope(content: EnvelopeContent, public_key: Vec<u8>, key_id: EcdsaKeyId) -> Result<Vec<u8>, String> {
    let request_id = to_request_id(&content).unwrap();

    let signature = crate::ecdsa::sign(key_id, *request_id).await.unwrap();

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
struct Envelope {
    content: EnvelopeContent,
    #[serde(with = "serde_bytes")]
    sender_pubkey: Option<Vec<u8>>,
    #[serde(with = "serde_bytes")]
    sender_sig: Option<Vec<u8>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "request_type", rename_all = "snake_case")]
pub enum EnvelopeContent {
    /// A replicated call to a canister method, whether update or query.
    Call {
        /// A random series of bytes to uniquely identify this message.
        #[serde(default, skip_serializing_if = "Option::is_none", with = "serde_bytes")]
        nonce: Option<Vec<u8>>,
        /// A nanosecond timestamp after which this request is no longer valid.
        ingress_expiry: u64,
        /// The principal that is sending this request.
        sender: Principal,
        /// The ID of the canister to be called.
        canister_id: Principal,
        /// The name of the canister method to be called.
        method_name: String,
        /// The argument to pass to the canister method.
        #[serde(with = "serde_bytes")]
        arg: Vec<u8>,
    },
}
