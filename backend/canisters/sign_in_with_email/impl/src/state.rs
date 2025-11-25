use crate::model::magic_links::MagicLinks;
use crate::model::salt::Salt;
use crate::{Hash, env};
use email_magic_links::DoubleSignedMagicLink;
use email_utils::{calculate_seed, delegation_signature_msg_hash};
use ic_canister_sig_creation::signature_map::{CanisterSigInputs, LABEL_SIG, SignatureMap};
use ic_canister_sig_creation::{CanisterSigPublicKey, DELEGATION_SIG_DOMAIN, delegation_signature_msg};
use ic_cdk::api::certified_data_set;
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sign_in_with_email_canister::{Delegation, EmailSenderConfig, NANOS_PER_MILLISECOND, SignedDelegation, TimestampMillis};
use std::cell::RefCell;

thread_local! {
    static STATE: RefCell<Option<State>> = RefCell::default();
}

#[derive(Serialize, Deserialize)]
pub struct State {
    #[serde(skip)]
    signature_map: SignatureMap,
    email_sender_config: Option<EmailSenderConfig>,
    email_sender_rsa_public_key: RsaPublicKey,
    magic_links: MagicLinks,
    rsa_private_key: Option<RsaPrivateKey>,
    salt: Salt,
    test_mode: bool,
}

const STATE_ALREADY_INITIALIZED: &str = "State has already been initialized";
const STATE_NOT_INITIALIZED: &str = "State has not been initialized";

pub fn init(state: State) {
    STATE.with_borrow_mut(|s| {
        if s.is_some() {
            panic!("{}", STATE_ALREADY_INITIALIZED);
        } else {
            *s = Some(state);
        }
    })
}

pub fn read<F: FnOnce(&State) -> R, R>(f: F) -> R {
    STATE.with_borrow(|s| f(s.as_ref().expect(STATE_NOT_INITIALIZED)))
}

pub fn mutate<F: FnOnce(&mut State) -> R, R>(f: F) -> R {
    STATE.with_borrow_mut(|s| f(s.as_mut().expect(STATE_NOT_INITIALIZED)))
}

pub fn take() -> State {
    STATE.take().expect(STATE_NOT_INITIALIZED)
}

impl State {
    pub fn new(email_sender_public_key: RsaPublicKey, test_mode: bool) -> State {
        State {
            signature_map: SignatureMap::default(),
            email_sender_config: None,
            email_sender_rsa_public_key: email_sender_public_key,
            magic_links: MagicLinks::default(),
            rsa_private_key: None,
            salt: Salt::default(),
            test_mode,
        }
    }

    pub fn email_sender_rsa_public_key(&self) -> &RsaPublicKey {
        &self.email_sender_rsa_public_key
    }

    pub fn email_sender_config(&self) -> Option<&EmailSenderConfig> {
        self.email_sender_config.as_ref()
    }

    pub fn set_email_sender_config(&mut self, config: EmailSenderConfig) {
        self.email_sender_config = Some(config);
    }

    pub fn rsa_public_key(&self) -> Option<RsaPublicKey> {
        self.rsa_private_key.as_ref().map(RsaPublicKey::from)
    }

    pub fn rsa_private_key(&self) -> Option<RsaPrivateKey> {
        self.rsa_private_key.clone()
    }

    pub fn set_rsa_private_key(&mut self, private_key: RsaPrivateKey) {
        self.rsa_private_key = Some(private_key);
    }

    pub fn salt(&self) -> [u8; 32] {
        self.salt.get()
    }

    pub fn set_salt(&mut self, salt: [u8; 32]) {
        self.salt.set(salt);
    }

    pub fn test_mode(&self) -> bool {
        self.test_mode
    }

    pub fn process_auth_request(
        &mut self,
        signed_magic_link: DoubleSignedMagicLink,
        code: String,
        is_update: bool,
        now: TimestampMillis,
    ) -> AuthResult {
        if !signed_magic_link.verify_sigs(self.rsa_public_key().unwrap(), self.email_sender_rsa_public_key.clone()) {
            return AuthResult::LinkInvalid("Invalid signature".to_string());
        };

        let magic_link = signed_magic_link.magic_link;

        if magic_link.expired(now) {
            return AuthResult::LinkExpired;
        } else if magic_link.code() != code {
            return AuthResult::CodeIncorrect;
        }

        let delegation = magic_link.delegation();
        let seed = self.calculate_seed(magic_link.email());

        let sig_inputs = CanisterSigInputs {
            domain: DELEGATION_SIG_DOMAIN,
            seed: &seed,
            message: &delegation_signature_msg(&delegation.pubkey, delegation.expiration, None),
        };

        if self.signature_map.get_signature_as_cbor(&sig_inputs, None).is_ok() {
            AuthResult::Success
        } else if !is_update {
            AuthResult::RequiresUpgrade
        } else {
            self.signature_map.add_signature(&sig_inputs);
            self.magic_links.mark_success(seed, sig_inputs.message_hash(), now);
            self.update_root_hash();

            AuthResult::Success
        }
    }

    pub fn get_delegation(&self, seed: Hash, delegation: Delegation) -> Option<SignedDelegation> {
        self.signature_map
            .get_signature_as_cbor(
                &CanisterSigInputs {
                    domain: DELEGATION_SIG_DOMAIN,
                    seed: &seed,
                    message: &delegation_signature_msg(&delegation.pubkey, delegation.expiration, None),
                },
                None,
            )
            .ok()
            .map(|s| SignedDelegation {
                delegation,
                signature: s,
            })
    }

    pub fn record_magic_link_sent(&mut self, seed: Hash, delegation: &Delegation, now: TimestampMillis) {
        let msg_hash = delegation_signature_msg_hash(delegation);
        self.magic_links
            .mark_magic_link_sent(seed, msg_hash, delegation.expiration / NANOS_PER_MILLISECOND, now);
    }

    pub fn calculate_seed(&self, email: &str) -> Hash {
        calculate_seed(self.salt.get(), email)
    }

    pub fn der_encode_canister_sig_key(&self, seed: Hash) -> Vec<u8> {
        let canister_id = env::canister_id();
        CanisterSigPublicKey::new(canister_id, seed.to_vec()).to_der()
    }

    fn update_root_hash(&mut self) {
        let prefixed_root_hash = ic_certification::labeled_hash(LABEL_SIG, &self.signature_map.root_hash());
        certified_data_set(&prefixed_root_hash[..]);
    }
}

pub enum AuthResult {
    Success,
    RequiresUpgrade,
    LinkExpired,
    CodeIncorrect,
    LinkInvalid(String),
}
