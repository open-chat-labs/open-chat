use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    AiActionCardTemplate, AiActionRecipientScope, AiActionRule, AiAppId, AiAppManifest, ContextItem, NormalizeOp, RuleMode,
    SurfaceDisplay, TimestampMillis,
};

/// Domain separator for the V2 commitment. It is deliberately outside the Candid value so a
/// future verifier contract can change its encoding without sharing a hash namespace with V2.
pub const MANIFEST_COMMITMENT_DOMAIN_V2: &[u8] = b"openchat.ai-app-manifest.v2\0";
/// Language-neutral encoding marker. Raw Candid bytes are deliberately not used: semantically
/// equivalent Candid values may have different type-table byte ordering across implementations.
pub const MANIFEST_COMMITMENT_ENCODING_V2: &[u8] = b"OC-MANIFEST\x02";
/// Optional append-only extension. It is omitted entirely for legacy/default confirmer-only
/// actions so their V2 manifest commitments remain byte-for-byte stable across this upgrade.
pub const RECIPIENT_SCOPE_EXTENSION_V1: &[u8] = b"OC-RECIPIENT-SCOPE\x01";

/// The value encoded with the explicit language-neutral format below and hashed for a V2
/// publication challenge.
///
/// `manifest` includes the original (non-canonical) name, app/inbox canister ids, all surfaces and
/// actions, endpoints, schemas, extraction rules and both app/action delivery keys. The explicit
/// fields bind that exact manifest to one OpenChat registry row and revision. Vector order remains
/// significant because it is significant in the registered manifest.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ManifestCommitmentV2 {
    pub user_index_canister_id: Principal,
    pub app_id: AiAppId,
    pub app_revision: TimestampMillis,
    pub owner: Principal,
    pub canonical_name: String,
    pub manifest: AiAppManifest,
}

/// Exact identity the app canister must have independently configured and echo back.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct VerificationBindingV2 {
    pub user_index_canister_id: Principal,
    pub app_id: AiAppId,
    pub app_revision: TimestampMillis,
    pub owner: Principal,
    pub canonical_name: String,
    pub app_canister_id: Principal,
    pub inbox_canister_id: Option<Principal>,
    pub manifest_hash: [u8; 32],
}

/// Builds the deterministic, domain-separated SHA-256 commitment used by V2.
pub fn manifest_hash_v2(commitment: &ManifestCommitmentV2) -> Result<[u8; 32], String> {
    let encoded = manifest_commitment_bytes_v2(commitment)?;
    let mut bytes = Vec::with_capacity(MANIFEST_COMMITMENT_DOMAIN_V2.len() + encoded.len());
    bytes.extend_from_slice(MANIFEST_COMMITMENT_DOMAIN_V2);
    bytes.extend_from_slice(&encoded);
    Ok(sha256::sha256(&bytes))
}

/// Encodes a manifest commitment without relying on a serializer's type-table or map ordering.
///
/// Grammar (all counts/byte lengths are unsigned u32 big-endian; u32/u64 values are big-endian):
/// `OC-MANIFEST || 0x02`, then the commitment fields in declaration order. Strings are UTF-8 byte
/// strings, principals are their raw bytes, vectors are count + elements, options are `0x00` or
/// `0x01 + value`, booleans are `0x00`/`0x01`, and enums use the zero-based tags documented in the
/// match statements below. Field order is fixed recursively and vector order is significant.
pub fn manifest_commitment_bytes_v2(commitment: &ManifestCommitmentV2) -> Result<Vec<u8>, String> {
    let mut out = CommitmentEncoder::new();
    out.raw(MANIFEST_COMMITMENT_ENCODING_V2);
    out.principal(commitment.user_index_canister_id)?;
    out.u32(commitment.app_id);
    out.u64(commitment.app_revision);
    out.principal(commitment.owner)?;
    out.string(&commitment.canonical_name)?;
    encode_manifest(&mut out, &commitment.manifest)?;
    Ok(out.finish())
}

struct CommitmentEncoder {
    bytes: Vec<u8>,
}

impl CommitmentEncoder {
    fn new() -> Self {
        Self { bytes: Vec::new() }
    }

    fn finish(self) -> Vec<u8> {
        self.bytes
    }

    fn raw(&mut self, value: &[u8]) {
        self.bytes.extend_from_slice(value);
    }

    fn u8(&mut self, value: u8) {
        self.bytes.push(value);
    }

    fn bool(&mut self, value: bool) {
        self.u8(u8::from(value));
    }

    fn u32(&mut self, value: u32) {
        self.bytes.extend_from_slice(&value.to_be_bytes());
    }

    fn u64(&mut self, value: u64) {
        self.bytes.extend_from_slice(&value.to_be_bytes());
    }

    fn len(&mut self, value: usize) -> Result<(), String> {
        self.u32(u32::try_from(value).map_err(|_| "manifest commitment field is too large".to_string())?);
        Ok(())
    }

    fn byte_string(&mut self, value: &[u8]) -> Result<(), String> {
        self.len(value.len())?;
        self.raw(value);
        Ok(())
    }

    fn string(&mut self, value: &str) -> Result<(), String> {
        self.byte_string(value.as_bytes())
    }

    fn principal(&mut self, value: Principal) -> Result<(), String> {
        self.byte_string(value.as_slice())
    }

    fn option<T>(&mut self, value: Option<&T>, encode: impl FnOnce(&mut Self, &T) -> Result<(), String>) -> Result<(), String> {
        match value {
            None => self.u8(0),
            Some(value) => {
                self.u8(1);
                encode(self, value)?;
            }
        }
        Ok(())
    }
}

fn encode_manifest(out: &mut CommitmentEncoder, manifest: &AiAppManifest) -> Result<(), String> {
    out.string(&manifest.name)?;
    out.string(&manifest.description)?;
    out.option(manifest.icon_url.as_ref(), |out, value| out.string(value))?;
    out.option(manifest.app_canister_id.as_ref(), |out, value| out.principal(*value))?;
    out.option(manifest.inbox_canister_id.as_ref(), |out, value| out.principal(*value))?;
    out.string(&manifest.consumer_public_key)?;
    out.bool(manifest.per_user_keys);
    out.len(manifest.actions.len())?;
    for action in &manifest.actions {
        out.string(&action.name)?;
        out.string(&action.description)?;
        out.string(&action.prompt_template)?;
        out.string(&action.response_schema)?;
        encode_card(out, &action.card)?;
        out.string(&action.endpoint)?;
        out.option(action.consumer_public_key.as_ref(), |out, value| out.string(value))?;
        out.len(action.rules.len())?;
        for rule in &action.rules {
            encode_rule(out, rule)?;
        }
        out.bool(action.accepts_image);
    }
    out.len(manifest.surfaces.len())?;
    for surface in &manifest.surfaces {
        out.string(&surface.kind)?;
        out.string(&surface.url)?;
        out.u8(match surface.display {
            SurfaceDisplay::Sheet => 0,
            SurfaceDisplay::External => 1,
        });
    }
    let app_authorized: Vec<_> = manifest
        .actions
        .iter()
        .enumerate()
        .filter(|(_, action)| matches!(action.recipient_scope, Some(AiActionRecipientScope::AppAuthorized)))
        .collect();
    if !app_authorized.is_empty() {
        out.raw(RECIPIENT_SCOPE_EXTENSION_V1);
        out.len(app_authorized.len())?;
        for (action_index, _action) in app_authorized {
            out.u32(u32::try_from(action_index).map_err(|_| "action index is too large".to_string())?);
            // Extension v1 defines tag 1 as app_authorized. Confirmer (tag 0) is canonicalized to
            // an absent policy and therefore never appears in the trailer.
            out.u8(1);
        }
    }
    Ok(())
}

fn encode_card(out: &mut CommitmentEncoder, card: &AiActionCardTemplate) -> Result<(), String> {
    out.string(&card.title)?;
    out.string(&card.confirm_label)?;
    out.string(&card.cancel_label)?;
    out.len(card.rows.len())?;
    for row in &card.rows {
        out.string(&row.field)?;
        out.string(&row.label)?;
    }
    out.option(card.disclosure.as_ref(), |out, value| out.string(value))
}

fn encode_rule(out: &mut CommitmentEncoder, rule: &AiActionRule) -> Result<(), String> {
    match rule {
        AiActionRule::KeywordMap(rule) => {
            out.u8(0);
            out.string(&rule.field)?;
            out.u8(match rule.mode {
                RuleMode::Hint => 0,
                RuleMode::Override => 1,
            });
            out.len(rule.map.len())?;
            for mapping in &rule.map {
                out.string(&mapping.value)?;
                out.len(mapping.keywords.len())?;
                for keyword in &mapping.keywords {
                    out.string(keyword)?;
                }
            }
        }
        AiActionRule::FromMessage(rule) => {
            out.u8(1);
            out.string(&rule.field)?;
            out.option(rule.max_length.as_ref(), |out, value| {
                out.u32(*value);
                Ok(())
            })?;
        }
        AiActionRule::Normalize(rule) => {
            out.u8(2);
            out.string(&rule.field)?;
            out.len(rule.ops.len())?;
            for op in &rule.ops {
                out.u8(match op {
                    NormalizeOp::KMSuffix => 0,
                    NormalizeOp::StripSymbols => 1,
                    NormalizeOp::Uppercase => 2,
                    NormalizeOp::Lowercase => 3,
                    NormalizeOp::Trim => 4,
                });
            }
        }
        AiActionRule::Instruction(rule) => {
            out.u8(3);
            out.string(&rule.text)?;
        }
        AiActionRule::Context(rule) => {
            out.u8(4);
            out.len(rule.provide.len())?;
            for item in &rule.provide {
                out.u8(match item {
                    ContextItem::Today => 0,
                });
            }
        }
    }
    Ok(())
}

/// Canonical namespace algorithm shared by the registry and verifier integrations.
///
/// ASCII-only names avoid Unicode confusables. Case and the common visual separators are ignored,
/// so `Acme App`, `acme-app`, `acme_app`, and `acme.app` share one publication namespace.
pub fn canonical_app_name(name: &str) -> Option<String> {
    let bytes = name.as_bytes();
    if bytes.is_empty() || !bytes.first()?.is_ascii_alphanumeric() || !bytes.last()?.is_ascii_alphanumeric() {
        return None;
    }

    let mut key = String::with_capacity(bytes.len());
    for &byte in bytes {
        if byte.is_ascii_alphanumeric() {
            key.push(byte.to_ascii_lowercase() as char);
        } else if !matches!(byte, b' ' | b'-' | b'_' | b'.') {
            return None;
        }
    }
    (!key.is_empty()).then_some(key)
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub binding: VerificationBindingV2,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Response {
    pub vouched: bool,
    /// Must equal the challenge byte-for-byte. An app must return its independently configured
    /// binding, not blindly reflect the request. OpenChat rejects every mismatch.
    pub binding: VerificationBindingV2,
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{
        AiActionCardRowTemplate, AiActionCardTemplate, AiActionDefinition, AiActionRecipientScope, AiAppSurface, SurfaceDisplay,
    };

    fn principal(value: u8) -> Principal {
        Principal::from_slice(&[value])
    }

    fn commitment() -> ManifestCommitmentV2 {
        ManifestCommitmentV2 {
            user_index_canister_id: principal(1),
            app_id: 7,
            app_revision: 99,
            owner: principal(2),
            canonical_name: "sampleapp".to_string(),
            manifest: AiAppManifest {
                name: "Sample App".to_string(),
                description: "A generic app".to_string(),
                icon_url: Some("https://app.example/icon.png".to_string()),
                app_canister_id: Some(principal(3)),
                inbox_canister_id: Some(principal(4)),
                consumer_public_key: "canonical-app-key".to_string(),
                per_user_keys: false,
                actions: vec![AiActionDefinition {
                    name: "sample.confirm".to_string(),
                    description: "Confirm".to_string(),
                    prompt_template: "Return JSON".to_string(),
                    response_schema: r#"{"type":"object"}"#.to_string(),
                    card: AiActionCardTemplate {
                        title: "Review".to_string(),
                        confirm_label: "Confirm".to_string(),
                        cancel_label: "Cancel".to_string(),
                        rows: vec![AiActionCardRowTemplate {
                            field: "value".to_string(),
                            label: "Value".to_string(),
                        }],
                        disclosure: None,
                    },
                    endpoint: "https://app.example/confirm".to_string(),
                    consumer_public_key: None,
                    recipient_scope: None,
                    rules: vec![],
                    accepts_image: false,
                }],
                surfaces: vec![AiAppSurface {
                    kind: "card".to_string(),
                    url: "https://app.example/card/{appId}".to_string(),
                    display: SurfaceDisplay::Sheet,
                }],
            },
        }
    }

    #[test]
    fn commitment_is_deterministic_and_domain_separated() {
        let value = commitment();
        let first = manifest_hash_v2(&value).unwrap();
        let second = manifest_hash_v2(&value).unwrap();
        assert_eq!(first, second);
        assert_eq!(
            first,
            [
                0x93, 0xf8, 0x2f, 0x31, 0xd3, 0x1c, 0x7c, 0xea, 0x66, 0xbd, 0x8d, 0x6e, 0x43, 0x4b, 0x77, 0x44, 0x2c, 0x03,
                0x5d, 0x73, 0x86, 0xf5, 0x2f, 0xad, 0x40, 0x19, 0x25, 0x06, 0x25, 0xdb, 0x71, 0xb9,
            ],
            "changing canonical encoding is a verifier protocol version change"
        );

        let language_neutral = manifest_commitment_bytes_v2(&value).unwrap();
        println!(
            "MANIFEST_COMMITMENT_V2_CANONICAL_HEX={}",
            language_neutral.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
        );
        assert!(language_neutral.starts_with(MANIFEST_COMMITMENT_ENCODING_V2));
        let candid_only = candid::encode_one(&value).unwrap();
        assert_ne!(language_neutral, candid_only);
        assert_ne!(first, sha256::sha256(&candid_only));
    }

    #[test]
    fn owner_canonical_name_revision_and_registry_are_committed() {
        let original = commitment();
        let expected = manifest_hash_v2(&original).unwrap();

        let mut changed = original.clone();
        changed.app_id += 1;
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.owner = principal(9);
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.canonical_name = "substituted".to_string();
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        // Even a raw-name variant with the same canonical key is a different reviewed manifest.
        let mut changed = original.clone();
        changed.manifest.name = "sample-app".to_string();
        assert_eq!(canonical_app_name(&changed.manifest.name).as_deref(), Some("sampleapp"));
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.app_revision += 1;
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original;
        changed.user_index_canister_id = principal(8);
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());
    }

    #[test]
    fn recipient_scope_extension_preserves_legacy_and_commits_only_app_authorized_actions() {
        let legacy = commitment();
        let legacy_bytes = manifest_commitment_bytes_v2(&legacy).unwrap();
        let legacy_hash = manifest_hash_v2(&legacy).unwrap();

        let mut explicit_confirmer = legacy.clone();
        explicit_confirmer.manifest.actions[0].recipient_scope = Some(AiActionRecipientScope::Confirmer);
        assert_eq!(manifest_commitment_bytes_v2(&explicit_confirmer).unwrap(), legacy_bytes);
        assert_eq!(manifest_hash_v2(&explicit_confirmer).unwrap(), legacy_hash);

        let mut app_authorized = legacy;
        app_authorized.manifest.actions[0].recipient_scope = Some(AiActionRecipientScope::AppAuthorized);
        let extended = manifest_commitment_bytes_v2(&app_authorized).unwrap();
        assert_eq!(&extended[..legacy_bytes.len()], legacy_bytes.as_slice());
        let mut expected_trailer = RECIPIENT_SCOPE_EXTENSION_V1.to_vec();
        expected_trailer.extend_from_slice(&1u32.to_be_bytes());
        expected_trailer.extend_from_slice(&0u32.to_be_bytes());
        expected_trailer.push(1);
        assert_eq!(&extended[legacy_bytes.len()..], expected_trailer);
        assert_ne!(manifest_hash_v2(&app_authorized).unwrap(), legacy_hash);
    }

    #[test]
    fn copied_canister_surface_action_and_key_substitutions_change_hash() {
        let original = commitment();
        let expected = manifest_hash_v2(&original).unwrap();

        let mut changed = original.clone();
        changed.manifest.app_canister_id = Some(principal(8));
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.manifest.inbox_canister_id = Some(principal(8));
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.manifest.surfaces[0].url = "https://evil.example/card/{appId}".to_string();
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original.clone();
        changed.manifest.actions[0].endpoint = "https://evil.example/confirm".to_string();
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());

        let mut changed = original;
        changed.manifest.per_user_keys = true;
        assert_ne!(expected, manifest_hash_v2(&changed).unwrap());
    }

    #[test]
    fn canonical_name_algorithm_is_strict_and_shared() {
        assert_eq!(canonical_app_name("Acme App").as_deref(), Some("acmeapp"));
        assert_eq!(canonical_app_name("ACME-app").as_deref(), Some("acmeapp"));
        assert!(canonical_app_name("-acme").is_none());
        assert!(canonical_app_name("acme-").is_none());
        assert!(canonical_app_name("аcme").is_none());
    }
}
