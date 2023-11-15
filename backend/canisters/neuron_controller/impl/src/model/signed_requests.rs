use ic_transport_types::{EnvelopeContent, RequestId};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct SignedRequests {
    requests: VecDeque<SignedRequestHumanReadable>,
}

impl SignedRequests {
    pub fn push(&mut self, request: SignedRequest) {
        self.requests.push_back((&request).into());
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &SignedRequestHumanReadable> + '_ {
        self.requests.iter()
    }

    pub fn len(&self) -> usize {
        self.requests.len()
    }
}

pub struct SignedRequest {
    pub timestamp: TimestampMillis,
    pub content: EnvelopeContent,
    pub request_id: RequestId,
    pub signature: Vec<u8>,
    pub body: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct SignedRequestHumanReadable {
    timestamp: TimestampMillis,
    content: EnvelopeContentHumanReadable,
    request_id: String,
    signature: String,
    body: String,
}

#[derive(Serialize, Deserialize)]
pub struct EnvelopeContentHumanReadable {
    nonce: Option<u128>,
    ingress_expiry: u64,
    sender: String,
    canister_id: String,
    method_name: String,
    arg: String,
}

impl From<&SignedRequest> for SignedRequestHumanReadable {
    fn from(value: &SignedRequest) -> Self {
        SignedRequestHumanReadable {
            timestamp: value.timestamp,
            content: (&value.content).into(),
            request_id: hex::encode(*value.request_id),
            signature: hex::encode(&value.signature),
            body: hex::encode(&value.body),
        }
    }
}

impl From<&EnvelopeContent> for EnvelopeContentHumanReadable {
    fn from(value: &EnvelopeContent) -> Self {
        if let EnvelopeContent::Call {
            nonce,
            ingress_expiry,
            sender,
            canister_id,
            method_name,
            arg,
        } = value
        {
            EnvelopeContentHumanReadable {
                nonce: nonce.as_ref().map(|n| {
                    let mut nonce_bytes = [0; 16];
                    nonce_bytes[16 - n.len()..].copy_from_slice(&n);
                    u128::from_be_bytes(nonce_bytes)
                }),
                ingress_expiry: *ingress_expiry,
                sender: sender.to_string(),
                canister_id: canister_id.to_string(),
                method_name: method_name.clone(),
                arg: hex::encode(arg),
            }
        } else {
            unreachable!()
        }
    }
}
