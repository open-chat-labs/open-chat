use candid::Principal;
use p256::PublicKey;
use p256::elliptic_curve::sec1::ToSec1Point;
use p256::pkcs8::DecodePublicKey;
use rand::CryptoRng;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_bytes::ByteBuf;
use types::{AiAppId, CanisterId, Chat, MessageId, MessageIndex, UserId};
use zeroize::{Zeroize, ZeroizeOnDrop};

const SECRET_BYTES: usize = 32;
const SUBJECT_DOMAIN_V1: &[u8] = b"openchat/ai-app/scoped-subject/v1\0";
const CHAT_HANDLE_DOMAIN_V1: &[u8] = b"openchat/ai-app/scoped-chat/v1\0";
const DIRECT_CHAT_HANDLE_DOMAIN_V1: &[u8] = b"openchat/ai-app/scoped-direct-chat/v1\0";
const MESSAGE_HANDLE_DOMAIN_V1: &[u8] = b"openchat/ai-app/scoped-message/v1\0";
const DIRECT_MESSAGE_HANDLE_DOMAIN_V1: &[u8] = b"openchat/ai-app/scoped-direct-message/v1\0";
const CONSUMER_QUEUE_SELECTOR_DOMAIN_V1: &[u8] = b"openchat/ai-app/consumer-queue-selector/v1\0";

/// Dedicated stable HMAC key for external-app pseudonyms. It is deliberately independent of both
/// OpenChat's established signing key and the rotatable action-deposit signing keyring.
#[derive(Default)]
pub struct AiAppScopedIdentityKey(Vec<u8>);

impl AiAppScopedIdentityKey {
    pub fn ensure_initialized(&mut self, rng: &mut impl CryptoRng) -> Result<bool, String> {
        if self.0.is_empty() {
            self.0.resize(SECRET_BYTES, 0);
            rng.fill_bytes(&mut self.0);
            return Ok(true);
        }
        if self.0.len() != SECRET_BYTES {
            return Err(format!(
                "AI-app scoped identity key must contain exactly {SECRET_BYTES} bytes"
            ));
        }
        Ok(false)
    }

    pub fn app_subject(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        user_id: UserId,
    ) -> Result<[u8; 32], String> {
        let mut preimage = app_scope_preimage(SUBJECT_DOMAIN_V1, user_index_canister_id, app_id, app_canister_id)?;
        put_principal(&mut preimage, user_id.as_principal())?;
        self.mac(&preimage)
    }

    pub fn chat_handle(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        chat: Chat,
    ) -> Result<[u8; 32], String> {
        let mut preimage = app_scope_preimage(CHAT_HANDLE_DOMAIN_V1, user_index_canister_id, app_id, app_canister_id)?;
        put_chat(&mut preimage, chat)?;
        self.mac(&preimage)
    }

    /// A direct chat is represented differently in each participant's User canister. Sort the
    /// exact pair before MACing so both sides obtain one canonical app-scoped handle without
    /// disclosing either global user id.
    pub fn direct_chat_handle(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        first_user_id: UserId,
        second_user_id: UserId,
    ) -> Result<[u8; 32], String> {
        if first_user_id == second_user_id {
            return Err("direct chat participants must be distinct".to_string());
        }
        let mut participants = [first_user_id.as_principal(), second_user_id.as_principal()];
        participants.sort_unstable_by(|a, b| a.as_slice().cmp(b.as_slice()));
        let mut preimage = app_scope_preimage(DIRECT_CHAT_HANDLE_DOMAIN_V1, user_index_canister_id, app_id, app_canister_id)?;
        put_principal(&mut preimage, participants[0])?;
        put_principal(&mut preimage, participants[1])?;
        self.mac(&preimage)
    }

    pub fn message_handle(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        chat: Chat,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Result<[u8; 32], String> {
        let mut preimage = app_scope_preimage(MESSAGE_HANDLE_DOMAIN_V1, user_index_canister_id, app_id, app_canister_id)?;
        put_chat(&mut preimage, chat)?;
        match thread_root_message_index {
            None => preimage.push(0),
            Some(index) => {
                preimage.push(1);
                preimage.extend_from_slice(&u32::from(index).to_be_bytes());
            }
        }
        preimage.extend_from_slice(&message_id.as_u64().to_be_bytes());
        self.mac(&preimage)
    }

    #[expect(
        clippy::too_many_arguments,
        reason = "Keep every domain-separated direct-message identity component explicit without changing the existing preimage"
    )]
    pub fn direct_message_handle(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        first_user_id: UserId,
        second_user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Result<[u8; 32], String> {
        if first_user_id == second_user_id {
            return Err("direct chat participants must be distinct".to_string());
        }
        let mut participants = [first_user_id.as_principal(), second_user_id.as_principal()];
        participants.sort_unstable_by(|a, b| a.as_slice().cmp(b.as_slice()));
        let mut preimage = app_scope_preimage(
            DIRECT_MESSAGE_HANDLE_DOMAIN_V1,
            user_index_canister_id,
            app_id,
            app_canister_id,
        )?;
        put_principal(&mut preimage, participants[0])?;
        put_principal(&mut preimage, participants[1])?;
        match thread_root_message_index {
            None => preimage.push(0),
            Some(index) => {
                preimage.push(1);
                preimage.extend_from_slice(&u32::from(index).to_be_bytes());
            }
        }
        preimage.extend_from_slice(&message_id.as_u64().to_be_bytes());
        self.mac(&preimage)
    }

    /// Opaque ActionInbox queue selector. Unlike a digest of public registry coordinates and the
    /// consumer public key, this value cannot be derived by another app that learns the PEM.
    /// UserIndex uses it when depositing; the exact app canister receives it only through an
    /// authenticated private contract such as a successful link-code claim.
    pub fn consumer_queue_selector(
        &self,
        user_index_canister_id: CanisterId,
        app_id: AiAppId,
        app_canister_id: CanisterId,
        inbox_canister_id: CanisterId,
        public_key_pem: &str,
    ) -> Result<[u8; 32], String> {
        let public_key = PublicKey::from_public_key_pem(public_key_pem)
            .map_err(|_| "consumer public key must be a valid P-256 SPKI PEM public key".to_string())?;
        let mut preimage = app_scope_preimage(
            CONSUMER_QUEUE_SELECTOR_DOMAIN_V1,
            user_index_canister_id,
            app_id,
            app_canister_id,
        )?;
        put_principal(&mut preimage, inbox_canister_id)?;
        preimage.extend_from_slice(public_key.to_sec1_point(false).as_bytes());
        self.mac(&preimage)
    }

    fn mac(&self, preimage: &[u8]) -> Result<[u8; 32], String> {
        if self.0.len() != SECRET_BYTES {
            return Err("AI-app scoped identity key is not initialized".to_string());
        }
        Ok(hmac_sha256::HMAC::mac(preimage, &self.0))
    }
}

fn app_scope_preimage(
    domain: &[u8],
    user_index_canister_id: CanisterId,
    app_id: AiAppId,
    app_canister_id: CanisterId,
) -> Result<Vec<u8>, String> {
    let mut preimage = Vec::with_capacity(domain.len() + 2 + 29 * 2 + 4);
    preimage.extend_from_slice(domain);
    put_principal(&mut preimage, user_index_canister_id)?;
    preimage.extend_from_slice(&app_id.to_be_bytes());
    put_principal(&mut preimage, app_canister_id)?;
    Ok(preimage)
}

fn put_chat(out: &mut Vec<u8>, chat: Chat) -> Result<(), String> {
    match chat {
        Chat::Direct(chat_id) => {
            out.push(0);
            put_principal(out, chat_id.into())
        }
        Chat::Group(chat_id) => {
            out.push(1);
            put_principal(out, chat_id.into())
        }
        Chat::Channel(community_id, channel_id) => {
            out.push(2);
            put_principal(out, community_id.into())?;
            out.extend_from_slice(&channel_id.as_u32().to_be_bytes());
            Ok(())
        }
    }
}

fn put_principal(out: &mut Vec<u8>, principal: Principal) -> Result<(), String> {
    let bytes = principal.as_slice();
    let len = u8::try_from(bytes.len()).map_err(|_| "principal is too long".to_string())?;
    out.push(len);
    out.extend_from_slice(bytes);
    Ok(())
}

impl Serialize for AiAppScopedIdentityKey {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&self.0)
    }
}

impl<'de> Deserialize<'de> for AiAppScopedIdentityKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(Self(ByteBuf::deserialize(deserializer)?.into_vec()))
    }
}

impl Drop for AiAppScopedIdentityKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl ZeroizeOnDrop for AiAppScopedIdentityKey {}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    fn user(value: u8) -> UserId {
        Principal::from_slice(&[value]).into()
    }

    #[test]
    fn legacy_subject_keeps_the_frozen_identity_bytes() {
        let key = AiAppScopedIdentityKey(vec![0x5a; SECRET_BYTES]);
        let subject = key
            .app_subject(Principal::from_slice(&[1]), 7, Principal::from_slice(&[8]), user(9))
            .unwrap();
        // Independently calculated with Node's HMAC-SHA256 from the original length-prefixed wire bytes.
        assert_eq!(
            hex::encode(subject),
            "16a5e0f490b898ee0672fce641b45b06875fcc3176416bb2f4e16d508e531f39"
        );
    }

    #[test]
    fn indexed_users_keep_distinct_subjects_and_direct_handles() {
        let key = AiAppScopedIdentityKey(vec![0x5a; SECRET_BYTES]);
        let registry = Principal::from_slice(&[1]);
        let app = Principal::from_slice(&[8]);
        let host = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let [a, b, c] = [1, 2, 3].map(|index| UserId::new_indexed(host, index));
        assert_eq!(a.canister_id(), b.canister_id());
        assert_ne!(
            key.app_subject(registry, 7, app, a).unwrap(),
            key.app_subject(registry, 7, app, b).unwrap()
        );
        let ab = key.direct_chat_handle(registry, 7, app, a, b).unwrap();
        assert_eq!(ab, key.direct_chat_handle(registry, 7, app, b, a).unwrap());
        assert_ne!(ab, key.direct_chat_handle(registry, 7, app, a, c).unwrap());
        let message = key.direct_message_handle(registry, 7, app, a, b, None, 1u64.into()).unwrap();
        assert_eq!(
            message,
            key.direct_message_handle(registry, 7, app, b, a, None, 1u64.into()).unwrap()
        );
        assert_ne!(
            message,
            key.direct_message_handle(registry, 7, app, a, c, None, 1u64.into()).unwrap()
        );
    }

    #[test]
    fn stable_secret_initializes_once_and_round_trips() {
        let mut rng = StdRng::seed_from_u64(41);
        let mut key = AiAppScopedIdentityKey::default();
        assert_eq!(key.ensure_initialized(&mut rng), Ok(true));
        let expected = key
            .app_subject(Principal::from_slice(&[1]), 7, Principal::from_slice(&[8]), user(9))
            .unwrap();
        assert_eq!(key.ensure_initialized(&mut rng), Ok(false));

        let encoded = msgpack::serialize_to_vec(&key).unwrap();
        let restored: AiAppScopedIdentityKey = msgpack::deserialize_then_unwrap(&encoded);
        assert_eq!(
            restored
                .app_subject(Principal::from_slice(&[1]), 7, Principal::from_slice(&[8]), user(9))
                .unwrap(),
            expected
        );
    }

    #[test]
    fn subjects_and_handles_are_exact_app_scoped_pseudonyms() {
        let mut rng = StdRng::seed_from_u64(42);
        let mut key = AiAppScopedIdentityKey::default();
        key.ensure_initialized(&mut rng).unwrap();
        let registry = Principal::from_slice(&[1]);
        let app_canister = Principal::from_slice(&[8]);
        let group = Principal::from_slice(&[20]);
        let chat = Chat::Group(group.into());

        let subject = key.app_subject(registry, 7, app_canister, user(9)).unwrap();
        assert_ne!(subject, key.app_subject(registry, 8, app_canister, user(9)).unwrap());
        assert_ne!(
            subject,
            key.app_subject(registry, 7, Principal::from_slice(&[10]), user(9)).unwrap()
        );
        assert_ne!(subject, key.app_subject(registry, 7, app_canister, user(10)).unwrap());

        let chat_handle = key.chat_handle(registry, 7, app_canister, chat).unwrap();
        assert_eq!(chat_handle, key.chat_handle(registry, 7, app_canister, chat).unwrap());
        assert_ne!(chat_handle, key.chat_handle(registry, 8, app_canister, chat).unwrap());
        assert_ne!(
            chat_handle,
            key.chat_handle(registry, 7, app_canister, Chat::Group(Principal::from_slice(&[21]).into()))
                .unwrap()
        );

        let message = key
            .message_handle(registry, 7, app_canister, chat, None, 1u64.into())
            .unwrap();
        assert_ne!(
            message,
            key.message_handle(registry, 7, app_canister, chat, None, 2u64.into())
                .unwrap()
        );
        assert_ne!(
            message,
            key.message_handle(registry, 7, app_canister, chat, Some(1u32.into()), 1u64.into())
                .unwrap()
        );
        assert_ne!(subject, chat_handle);
        assert_ne!(chat_handle, message);

        let direct_ab = key.direct_chat_handle(registry, 7, app_canister, user(9), user(10)).unwrap();
        let direct_ba = key.direct_chat_handle(registry, 7, app_canister, user(10), user(9)).unwrap();
        assert_eq!(direct_ab, direct_ba);
        assert_ne!(
            direct_ab,
            key.direct_chat_handle(registry, 7, app_canister, user(9), user(11)).unwrap()
        );
        assert!(key.direct_chat_handle(registry, 7, app_canister, user(9), user(9)).is_err());
    }

    #[test]
    fn queue_selector_requires_the_secret_even_with_public_pem_and_route_coordinates() {
        use p256_key_pair::P256KeyPair;

        let registry = Principal::from_slice(&[1]);
        let app_canister = Principal::from_slice(&[8]);
        let inbox = Principal::from_slice(&[11]);
        let public_key = P256KeyPair::new(&mut StdRng::seed_from_u64(99)).public_key_pem().to_string();
        let mut key = AiAppScopedIdentityKey::default();
        key.ensure_initialized(&mut StdRng::seed_from_u64(42)).unwrap();
        let selector = key
            .consumer_queue_selector(registry, 7, app_canister, inbox, &public_key)
            .unwrap();

        // A malicious app can know all of these values and the public PEM, but hashing them does
        // not reveal the HMAC selector accepted by ActionInbox.
        let parsed = PublicKey::from_public_key_pem(&public_key).unwrap();
        let mut public_attempt = app_scope_preimage(CONSUMER_QUEUE_SELECTOR_DOMAIN_V1, registry, 7, app_canister).unwrap();
        put_principal(&mut public_attempt, inbox).unwrap();
        public_attempt.extend_from_slice(parsed.to_sec1_point(false).as_bytes());
        assert_ne!(sha256::sha256(&public_attempt), selector);

        let mut other_authority = AiAppScopedIdentityKey::default();
        other_authority.ensure_initialized(&mut StdRng::seed_from_u64(43)).unwrap();
        assert_ne!(
            other_authority
                .consumer_queue_selector(registry, 7, app_canister, inbox, &public_key)
                .unwrap(),
            selector
        );
        assert_ne!(
            key.consumer_queue_selector(registry, 8, app_canister, inbox, &public_key)
                .unwrap(),
            selector
        );
    }

    #[test]
    fn malformed_restored_secret_fails_closed() {
        let encoded = msgpack::serialize_to_vec(ByteBuf::from(vec![1; SECRET_BYTES - 1])).unwrap();
        let mut key: AiAppScopedIdentityKey = msgpack::deserialize_then_unwrap(&encoded);
        assert!(key.ensure_initialized(&mut StdRng::seed_from_u64(43)).is_err());
        assert!(
            key.app_subject(Principal::from_slice(&[1]), 7, Principal::from_slice(&[8]), user(9))
                .is_err()
        );
    }
}
