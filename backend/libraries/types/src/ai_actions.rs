use crate::{ActionCardContentInitial, ActionCardRow, CanisterId, Chat, MessageId, MessageIndex, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use sha2::{Digest, Sha256};
use ts_export::ts_export;

pub type AiAppId = u32;

pub const APP_SCOPED_CARD_CONTEXT_VERSION_V1: u16 = 1;

/// App-facing pseudonymous identity for one card. OpenChat's raw user, chat, thread, and message
/// coordinates stay inside its authority chain; an external app receives only dedicated-key HMAC
/// handles scoped to the exact UserIndex, app id, and registered app canister.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AppScopedCardContext {
    pub context_version: u16,
    #[ts(as = "ts_export::TSBytes")]
    pub app_subject: ByteBuf,
    #[ts(as = "ts_export::TSBytes")]
    pub chat_handle: ByteBuf,
    #[ts(as = "ts_export::TSBytes")]
    pub message_handle: ByteBuf,
    pub app_id: AiAppId,
    pub app_revision: TimestampMillis,
    pub action_id: String,
}

/// Immutable, app-agnostic provenance returned to an app after it redeems a one-time card
/// capability. `chat_key` is the canonical stable rendering used by external integrations while
/// `chat` preserves the structured OpenChat identity.
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AiAppCardContext {
    pub user_id: UserId,
    pub chat: Chat,
    pub chat_key: String,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub app_id: AiAppId,
    pub app_revision: TimestampMillis,
    pub action_id: String,
}

/// Exact sender-visible and confirmable content accepted by a registered app canister. Routing,
/// bearer provenance and recipient keys are deliberately excluded: chat/UserIndex derive those.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AiAppCardContentV1 {
    pub title: String,
    pub rows: Vec<ActionCardRow>,
    pub confirm_label: String,
    pub cancel_label: String,
    pub action_id: String,
    pub disclosure: Option<String>,
    pub expires_at: Option<TimestampMillis>,
    #[ts(as = "Option::<ts_export::TSBytes>")]
    pub confirm_payload: Option<ByteBuf>,
}

impl From<&ActionCardContentInitial> for AiAppCardContentV1 {
    fn from(value: &ActionCardContentInitial) -> Self {
        Self {
            title: value.title.clone(),
            rows: value.rows.clone(),
            confirm_label: value.confirm_label.clone(),
            cancel_label: value.cancel_label.clone(),
            action_id: value.action_id.clone(),
            disclosure: value.disclosure.clone(),
            expires_at: value.expires_at,
            confirm_payload: value.confirm_payload.clone(),
        }
    }
}

/// Canonical card commitment recomputed by the destination chat canister from raw message ingress.
/// The registered app canister vouches for this exact value before UserIndex mints provenance.
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AiAppCardContentCommitmentV1 {
    pub user_id: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub app_id: AiAppId,
    pub app_revision: TimestampMillis,
    pub content: AiAppCardContentV1,
}

const CARD_CONTENT_HASH_DOMAIN_V1: &[u8] = b"openchat.ai-app-card-content.v1\0";
const CARD_CONTENT_CANONICAL_PREFIX_V1: &[u8] = b"OC-CARD\x01";
const CARD_CONFIRM_PAYLOAD_HASH_DOMAIN_V1: &[u8] = b"openchat.ai-app-card-confirm-payload.v1\0";
const PRIVATE_MATCH_SOURCE_HASH_DOMAIN_V1: &[u8] = b"openchat.ai-app-private-match-source.v1\0";
pub const MAX_ATTESTED_ACTION_CARD_BYTES: usize = 64 * 1024;
pub const MAX_AI_APP_CONFIRM_PAYLOAD_BYTES: usize = 16 * 1024;
pub const AI_APP_CARD_TOKEN_BYTES: usize = 32;

pub fn validate_ai_app_card_content_v1(value: &AiAppCardContentV1, now: TimestampMillis) -> Result<(), String> {
    fn chars_between(value: &str, min: usize, max: usize) -> bool {
        let length = value.chars().count();
        (min..=max).contains(&length) && (min == 0 || !value.trim().is_empty())
    }

    if !chars_between(&value.title, 1, 200)
        || !chars_between(&value.confirm_label, 1, 80)
        || !chars_between(&value.cancel_label, 1, 80)
        || !chars_between(&value.action_id, 1, 128)
        || value.rows.is_empty()
        || value.rows.len() > 32
        || value.disclosure.as_ref().is_some_and(|v| v.chars().count() > 1_000)
        || value.expires_at.is_some_and(|expires_at| expires_at <= now)
        || value
            .confirm_payload
            .as_ref()
            .is_some_and(|payload| payload.is_empty() || payload.len() > MAX_AI_APP_CONFIRM_PAYLOAD_BYTES)
        || value
            .rows
            .iter()
            .any(|row| !chars_between(&row.label, 1, 128) || row.value.chars().count() > 4_096)
    {
        return Err("AI-app card content is outside the supported bounds".to_string());
    }
    let encoded = canonical_ai_app_card_content_commitment_bytes_v1(&AiAppCardContentCommitmentV1 {
        user_id: candid::Principal::anonymous().into(),
        chat: Chat::Group(candid::Principal::anonymous().into()),
        thread_root_message_index: None,
        message_id: 0u64.into(),
        app_id: 0,
        app_revision: 0,
        content: value.clone(),
    })?;
    if encoded.len() > MAX_ATTESTED_ACTION_CARD_BYTES {
        return Err(format!(
            "AI-app card canonical content must be at most {MAX_ATTESTED_ACTION_CARD_BYTES} bytes"
        ));
    }
    Ok(())
}

/// Portable canonical encoding. All lengths/counts and integers are big-endian; strings are UTF-8;
/// options are tagged 0/1; chat variants use zero-based tags. Apps in any language can reproduce it.
pub fn canonical_ai_app_card_content_commitment_bytes_v1(value: &AiAppCardContentCommitmentV1) -> Result<Vec<u8>, String> {
    fn put_len(out: &mut Vec<u8>, len: usize) -> Result<(), String> {
        let len = u32::try_from(len).map_err(|_| "AI-app card field is too large".to_string())?;
        out.extend_from_slice(&len.to_be_bytes());
        Ok(())
    }
    fn put_bytes(out: &mut Vec<u8>, value: &[u8]) -> Result<(), String> {
        put_len(out, value.len())?;
        out.extend_from_slice(value);
        Ok(())
    }
    fn put_string(out: &mut Vec<u8>, value: &str) -> Result<(), String> {
        put_bytes(out, value.as_bytes())
    }
    fn put_principal(out: &mut Vec<u8>, value: candid::Principal) -> Result<(), String> {
        put_bytes(out, value.as_slice())
    }

    let mut out = Vec::new();
    out.extend_from_slice(CARD_CONTENT_CANONICAL_PREFIX_V1);
    // Commit the user's wire identity, not the holding canister shared by indexed users.
    put_principal(&mut out, value.user_id.as_principal())?;
    match value.chat {
        Chat::Direct(chat_id) => {
            out.push(0);
            put_principal(&mut out, chat_id.into())?;
        }
        Chat::Group(chat_id) => {
            out.push(1);
            put_principal(&mut out, chat_id.into())?;
        }
        Chat::Channel(community_id, channel_id) => {
            out.push(2);
            put_principal(&mut out, community_id.into())?;
            out.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        }
    }
    match value.thread_root_message_index {
        None => out.push(0),
        Some(index) => {
            out.push(1);
            out.extend_from_slice(&u32::from(index).to_be_bytes());
        }
    }
    out.extend_from_slice(&value.message_id.as_u64().to_be_bytes());
    out.extend_from_slice(&value.app_id.to_be_bytes());
    out.extend_from_slice(&value.app_revision.to_be_bytes());
    put_string(&mut out, &value.content.title)?;
    put_len(&mut out, value.content.rows.len())?;
    for row in &value.content.rows {
        put_string(&mut out, &row.label)?;
        put_string(&mut out, &row.value)?;
    }
    put_string(&mut out, &value.content.confirm_label)?;
    put_string(&mut out, &value.content.cancel_label)?;
    put_string(&mut out, &value.content.action_id)?;
    match &value.content.disclosure {
        None => out.push(0),
        Some(disclosure) => {
            out.push(1);
            put_string(&mut out, disclosure)?;
        }
    }
    match value.content.expires_at {
        None => out.push(0),
        Some(expires_at) => {
            out.push(1);
            out.extend_from_slice(&expires_at.to_be_bytes());
        }
    }
    match &value.content.confirm_payload {
        None => out.push(0),
        Some(payload) => {
            out.push(1);
            put_bytes(&mut out, payload)?;
        }
    }
    Ok(out)
}

pub fn ai_app_card_content_commitment_hash_v1(value: &AiAppCardContentCommitmentV1) -> Result<[u8; 32], String> {
    let canonical = canonical_ai_app_card_content_commitment_bytes_v1(value)?;
    if canonical.len() > MAX_ATTESTED_ACTION_CARD_BYTES {
        return Err(format!(
            "AI-app card canonical commitment must be at most {MAX_ATTESTED_ACTION_CARD_BYTES} bytes"
        ));
    }
    let mut hasher = Sha256::new();
    hasher.update(CARD_CONTENT_HASH_DOMAIN_V1);
    hasher.update(canonical);
    Ok(hasher.finalize().into())
}

/// Domain-separated digest for an exact final confirmation payload. The explicit big-endian length
/// makes this portable across app implementations and prevents concatenation ambiguity.
pub fn ai_app_card_confirm_payload_hash_v1(payload: &[u8]) -> Result<[u8; 32], String> {
    let len = u32::try_from(payload.len()).map_err(|_| "AI-app confirmation payload is too large".to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(CARD_CONFIRM_PAYLOAD_HASH_DOMAIN_V1);
    hasher.update(len.to_be_bytes());
    hasher.update(payload);
    Ok(hasher.finalize().into())
}

/// Domain-separated commitment to the exact UTF-8 text of one authoritative chat message.
///
/// A private-match iframe receives the source text from its OpenChat host, while the registered app
/// canister receives this digest only after redeeming a message-bound one-time capability. The
/// iframe must reproduce the digest before consulting private app data, so a compromised host
/// cannot turn the surface into an arbitrary keyword-membership oracle.
pub fn ai_app_private_match_source_hash_v1(source: &str) -> [u8; 32] {
    let bytes = source.as_bytes();
    let mut hasher = Sha256::new();
    hasher.update(PRIVATE_MATCH_SOURCE_HASH_DOMAIN_V1);
    hasher.update((bytes.len() as u64).to_be_bytes());
    hasher.update(bytes);
    hasher.finalize().into()
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiAppCardCapabilityScope {
    #[serde(rename = "private_context")]
    PrivateContext,
}

/// The caller-supplied part of an AI app registration: one manifest covering the app's identity, its
/// app-level delivery key and every action it offers. Registering the same `name` again (by the same
/// owner) upserts the whole manifest, so an external app can keep itself up to date with a single call
/// from a deploy script.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiAppManifest {
    /// Stable, human-readable ASCII identifier. Case and visual separators share a canonical key.
    /// Re-registering the caller's key upserts its stable id. Unpublished reservations are bounded
    /// and expiring; only a canister-vouched, governance-published app owns the key exclusively.
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub icon_url: Option<String>,
    /// The app's own IC canister. When set, `publish_ai_app` calls its generic
    /// `c2c_verify_ai_app_v2` method and publishes only when it vouches for the exact registry,
    /// owner, canonical name, app id/revision and full manifest commitment. This is app-agnostic:
    /// OpenChat knows only the well-known verifier contract. `serde(default)` preserves
    /// upgrade/wire compatibility like the other optional fields.
    // The ts_export macro only auto-maps a bare `CanisterId`; `Option<CanisterId>` needs the
    // TSPrincipal representation spelled out (Principal has no TS impl).
    #[serde(default)]
    #[ts(as = "Option::<ts_export::TSPrincipal>", optional)]
    pub app_canister_id: Option<CanisterId>,
    /// Optional per-app inbox canister: confirmed actions from this app are deposited here instead of
    /// OpenChat's globally configured action_inbox (per-app isolation + cycles). App-declared routing,
    /// carried onto each confirmed action card; OpenChat never interprets the deposited payload.
    #[serde(default)]
    #[ts(as = "Option::<ts_export::TSPrincipal>", optional)]
    pub inbox_canister_id: Option<CanisterId>,
    /// P-256 SPKI PEM: the app-level delivery key confirmed actions are encrypted/verified against.
    /// May be empty when `per_user_keys` is set — delivery then always targets the acting user's own
    /// registered key and this app-level key is never read.
    pub consumer_public_key: String,
    /// When set, each user's confirmed actions are delivered encrypted to that user's own registered
    /// key (see `AiAppUserKey`) instead of the app-level `consumer_public_key`. A user with no key
    /// registered yet must link the app first (via a one-time link code) before actions can run.
    #[serde(default)]
    pub per_user_keys: bool,
    /// The actions this app offers. A per-action `consumer_public_key`, when set, overrides the app key.
    pub actions: Vec<AiActionDefinition>,
    /// App-declared UI surfaces OpenChat can open on the app's behalf (e.g. a chat-linking page).
    /// Absent on the wire means none.
    #[serde(default)]
    pub surfaces: Vec<AiAppSurface>,
}

/// A UI surface an app declares in its manifest: a URL OpenChat opens at well-known moments so the
/// user can configure the app without leaving the chat client.
// PartialEq/Eq so a re-registration can detect a changed surface set (which must re-run the publish
// vouch — see AiAppRegistry::register).
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AiAppSurface {
    /// What the surface is for. "chat_link" = configure/link a chat inside the app (opened by
    /// OpenChat after the first confirmed action in a chat). Other kinds are app-defined; OpenChat
    /// ignores kinds it does not know.
    pub kind: String,
    /// URL template. The only substituted placeholder is the public {appId}. App-scoped
    /// subject/chat/message handles are delivered over authenticated card/link contracts, never
    /// in navigation URLs.
    pub url: String,
    pub display: SurfaceDisplay,
}

/// How OpenChat presents a surface when it opens it.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
// Per-variant renames — see AiActionRule for why rename_all cannot be used with candid.
pub enum SurfaceDisplay {
    /// Embedded in-app (an iframe hosted in a bottom sheet).
    #[serde(rename = "sheet")]
    Sheet,
    /// Opened in the system browser / a new tab.
    #[serde(rename = "external")]
    External,
}

/// A single user's registered delivery key for one app: when the app's manifest sets
/// `per_user_keys`, that user's confirmed actions are encrypted to this key.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiAppUserKey {
    pub app_id: AiAppId,
    /// P-256 SPKI PEM public key.
    pub public_key: String,
    /// Monotonic consent epoch for this exact (user, app) binding. A fresh app-authenticated
    /// link-code claim advances it even when the app deliberately reuses the same durable key.
    // Optional in generated TypeScript so a frontend can roll out before UserIndex. The upgraded
    // Rust canister always serializes this authoritative value.
    #[ts(as = "Option::<u64>", optional)]
    pub key_version: u64,
}

/// One (user, key) row of an `ai_app_user_keys` lookup — a chat MEMBER's registered delivery key
/// for one app. Public-key material only; used at propose time to fan a confirmed action out to
/// every chat member with a registered key (each member's deposit encrypted to their own key).
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiAppMemberKey {
    pub user_id: UserId,
    /// P-256 SPKI PEM public key.
    pub public_key: String,
}

/// A registered AI app. The on-chain `id`, `owner` and timestamps are assigned by the canister.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiAppRegistration {
    pub id: AiAppId,
    pub owner: UserId,
    pub manifest: AiAppManifest,
    pub created: TimestampMillis,
    pub updated: TimestampMillis,
    /// Directory visibility: a new registration starts UNPUBLISHED (visible only to its owner, so
    /// it can be developed/tested privately); `publish_ai_app` flips it. `serde(default)` makes
    /// pre-upgrade entries deserialize as unpublished. A sibling of `manifest` deliberately; a
    /// changed manifest resets it and requires a fresh exact-revision verifier decision.
    #[serde(default)]
    pub published: bool,
}

/// A single, generic "AI action": an app-supplied configuration that lets a client-side model propose a
/// *confirmable, authenticated* in-chat action. Nothing here is specific to any one app — the prompt,
/// output schema, card layout and delivery endpoint are all supplied by the app that declares the action,
/// so the same mechanism serves any consumer.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiActionDefinition {
    /// Stable, human-readable identifier (e.g. "expense.import"), unique per owner.
    pub name: String,
    pub description: String,
    /// Prompt the on-device model is run with; the client substitutes the user's input before inference.
    pub prompt_template: String,
    /// JSON Schema the model's structured output must conform to.
    pub response_schema: String,
    /// How to turn the model's output into a confirmable card shown to the user.
    pub card: AiActionCardTemplate,
    /// Where a confirmed action is delivered — the consumer's signed webhook endpoint.
    pub endpoint: String,
    /// Optional public key (PEM) the consumer advertises so the payload can be verified end-to-end.
    pub consumer_public_key: Option<String>,
    /// Who may receive a per-user-key action after confirmation. Missing is the legacy, least-
    /// privilege behaviour: only the authoritative confirmer. `app_authorized` asks the vouched
    /// app canister to select an exact bounded recipient set using only app-scoped identities.
    #[serde(default)]
    pub recipient_scope: Option<AiActionRecipientScope>,
    /// Optional extraction rules that steer the model's prompt and deterministically post-process its
    /// output on the client. Absent means no rules.
    #[serde(default)]
    pub rules: Vec<AiActionRule>,
    /// When true, this action can extract from an IMAGE message, so OpenChat's auto-propose chip
    /// offers it on images. Absent (manifests predating the flag) === false — an app opts in.
    #[serde(default)]
    pub accepts_image: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiActionRecipientScope {
    #[serde(rename = "confirmer")]
    Confirmer,
    #[serde(rename = "app_authorized")]
    AppAuthorized,
}

#[cfg(test)]
mod recipient_scope_compatibility_tests {
    use super::*;

    #[derive(CandidType, Serialize)]
    struct LegacyAiActionDefinition {
        name: String,
        description: String,
        prompt_template: String,
        response_schema: String,
        card: AiActionCardTemplate,
        endpoint: String,
        consumer_public_key: Option<String>,
        rules: Vec<AiActionRule>,
        accepts_image: bool,
    }

    #[test]
    fn action_without_recipient_scope_decodes_as_confirmer_only() {
        let encoded = candid::encode_one(LegacyAiActionDefinition {
            name: "legacy.action".to_string(),
            description: String::new(),
            prompt_template: "return json".to_string(),
            response_schema: "{}".to_string(),
            card: AiActionCardTemplate {
                title: "Review".to_string(),
                confirm_label: "Confirm".to_string(),
                cancel_label: "Cancel".to_string(),
                rows: Vec::new(),
                disclosure: None,
            },
            endpoint: "https://app.example/action".to_string(),
            consumer_public_key: None,
            rules: Vec::new(),
            accepts_image: false,
        })
        .unwrap();
        let decoded: AiActionDefinition = candid::decode_one(&encoded).unwrap();
        assert_eq!(decoded.recipient_scope, None);
    }
}

/// A single, generic extraction rule. Rules are declared by whoever registers the action and are
/// interpreted entirely on the client: some contribute guidance lines to the prompt, others run as a
/// deterministic post-pass over the model's structured output.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
// Per-variant renames (NOT rename_all): candid_derive ignores `rename_all` but honors per-variant
// `serde(rename)`, while serde's Deserialize honors both — explicit renames are the only way to make
// the candid type table and the serde decode path agree on the snake_case wire labels.
pub enum AiActionRule {
    #[serde(rename = "keyword_map")]
    KeywordMap(KeywordMapRule),
    #[serde(rename = "from_message")]
    FromMessage(FromMessageRule),
    #[serde(rename = "normalize")]
    Normalize(NormalizeRule),
    #[serde(rename = "instruction")]
    Instruction(InstructionRule),
    #[serde(rename = "context")]
    Context(ContextRule),
}

/// Maps keywords found in the user's message to a fixed value for one output field.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct KeywordMapRule {
    /// Key in the model's JSON output this rule targets.
    pub field: String,
    pub mode: RuleMode,
    pub map: Vec<KeywordMapping>,
}

/// One value and the keywords whose presence in the message selects it.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct KeywordMapping {
    pub value: String,
    pub keywords: Vec<String>,
}

/// Whether a rule merely guides the model (`Hint`) or deterministically overrides its output (`Override`).
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
// Per-variant renames — see AiActionRule for why rename_all cannot be used with candid.
pub enum RuleMode {
    #[serde(rename = "hint")]
    Hint,
    #[serde(rename = "override")]
    Override,
}

/// Fills one output field directly from the user's message text, bypassing the model.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct FromMessageRule {
    /// Key in the model's JSON output this rule targets.
    pub field: String,
    /// Maximum length the copied text is truncated to (defaults to 200 on the client).
    #[serde(default)]
    pub max_length: Option<u32>,
}

/// Applies deterministic normalization operations, in order, to one output field.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct NormalizeRule {
    /// Key in the model's JSON output this rule targets.
    pub field: String,
    pub ops: Vec<NormalizeOp>,
}

/// A single normalization operation applied to a field's value.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
// Per-variant renames — see AiActionRule for why rename_all cannot be used with candid.
pub enum NormalizeOp {
    /// Converts strings like "26k" / "1.5m" into numbers (x1e3 / x1e6).
    #[serde(rename = "k_m_suffix")]
    KMSuffix,
    /// Strips currency symbols, commas and spaces, then parses a number when possible.
    #[serde(rename = "strip_symbols")]
    StripSymbols,
    #[serde(rename = "uppercase")]
    Uppercase,
    #[serde(rename = "lowercase")]
    Lowercase,
    #[serde(rename = "trim")]
    Trim,
}

/// Free-form guidance appended verbatim to the prompt.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct InstructionRule {
    pub text: String,
}

/// Declares contextual values the client injects into the prompt.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct ContextRule {
    pub provide: Vec<ContextItem>,
}

/// A contextual value the client can provide to the model.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
// Per-variant rename — see AiActionRule for why rename_all cannot be used with candid.
pub enum ContextItem {
    /// Today's date, injected as "Today is <YYYY-MM-DD>."
    #[serde(rename = "today")]
    Today,
}

/// Generic, app-agnostic template describing the confirmable card produced from the model's output.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiActionCardTemplate {
    pub title: String,
    pub confirm_label: String,
    pub cancel_label: String,
    pub rows: Vec<AiActionCardRowTemplate>,
    pub disclosure: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AiActionCardRowTemplate {
    /// Key in the model's JSON output to read this row's value from.
    pub field: String,
    /// Human-readable label shown on the card row.
    pub label: String,
}

#[cfg(test)]
mod card_content_commitment_tests {
    use super::*;
    use candid::Principal;

    fn fixture() -> AiAppCardContentCommitmentV1 {
        AiAppCardContentCommitmentV1 {
            user_id: Principal::from_slice(&[1, 2, 3]).into(),
            chat: Chat::Channel(Principal::from_slice(&[10, 11]).into(), 0x0102_0304u32.into()),
            thread_root_message_index: Some(0x0a0b_0c0du32.into()),
            message_id: 0x0102_0304_0506_0708u64.into(),
            app_id: 0x0a0b_0c0d,
            app_revision: 0x1112_1314_1516_1718,
            content: AiAppCardContentV1 {
                title: "Résumé 🧪".to_string(),
                rows: vec![
                    ActionCardRow {
                        label: "Category".to_string(),
                        value: "travel".to_string(),
                    },
                    ActionCardRow {
                        label: "状态".to_string(),
                        value: "ready".to_string(),
                    },
                ],
                confirm_label: "Submit".to_string(),
                cancel_label: "Back".to_string(),
                action_id: "sample.submit".to_string(),
                disclosure: Some("example ✓".to_string()),
                expires_at: Some(0x2122_2324_2526_2728),
                confirm_payload: Some(ByteBuf::from(vec![0, 255, 16])),
            },
        }
    }

    fn hash(value: &AiAppCardContentCommitmentV1) -> [u8; 32] {
        ai_app_card_content_commitment_hash_v1(value).unwrap()
    }

    fn assert_changes_hash(mutated: AiAppCardContentCommitmentV1, baseline: [u8; 32]) {
        assert_ne!(hash(&mutated), baseline);
    }

    #[test]
    fn frozen_canonical_bytes_and_sha256_vector() {
        // Independently generated from the protocol description (Node Buffer/DataView primitives).
        // This freezes UTF-8, principal lengths, tags, ordering and big-endian integer widths.
        const BYTES_HEX: &str = "4f432d43415244010000000301020302000000020a0b01020304010a0b0c0d01020304050607080a0b0c0d11121314151617180000000d52c3a973756dc3a920f09fa7aa000000020000000843617465676f72790000000674726176656c00000006e78ab6e68081000000057265616479000000065375626d6974000000044261636b0000000d73616d706c652e7375626d6974010000000b6578616d706c6520e29c93012122232425262728010000000300ff10";
        const HASH_HEX: &str = "423499cd3d033da175a0ad7f01b305f4a57331a30e2c87d164b9742aa2717295";
        assert_eq!(
            canonical_ai_app_card_content_commitment_bytes_v1(&fixture()).unwrap(),
            hex::decode(BYTES_HEX).unwrap()
        );
        assert_eq!(hash(&fixture()).as_slice(), hex::decode(HASH_HEX).unwrap());
    }

    #[test]
    fn indexed_users_in_the_same_canister_have_distinct_exact_commitments() {
        let canister_id = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let mut commitments = std::collections::HashSet::new();
        let mut users = vec![UserId::new(canister_id)];
        users.extend([1, 2, crate::user::MAX_USER_INDEX].map(|index| UserId::new_indexed(canister_id, index)));

        for user_id in users {
            assert_eq!(user_id.canister_id(), canister_id);
            let mut value = fixture();
            value.user_id = user_id;
            let canonical = canonical_ai_app_card_content_commitment_bytes_v1(&value).unwrap();
            let length_offset = CARD_CONTENT_CANONICAL_PREFIX_V1.len();
            let identity_offset = length_offset + 4;
            let identity_length = u32::from_be_bytes(canonical[length_offset..identity_offset].try_into().unwrap()) as usize;
            assert_eq!(identity_length, user_id.as_slice().len());
            assert_eq!(
                &canonical[identity_offset..identity_offset + identity_length],
                user_id.as_slice(),
                "the canonical identity must retain the exact user index"
            );
            assert!(
                commitments.insert(hash(&value)),
                "a different user must not reuse a card commitment"
            );
        }
    }

    #[test]
    fn every_committed_field_and_row_order_changes_the_hash() {
        let original = fixture();
        let baseline = hash(&original);

        let mut value = original.clone();
        value.user_id = Principal::from_slice(&[4]).into();
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.chat = Chat::Group(Principal::from_slice(&[10, 11]).into());
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.thread_root_message_index = None;
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.message_id = 9u64.into();
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.app_id += 1;
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.app_revision += 1;
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.title.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.rows[0].label.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.rows[0].value.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.rows.swap(0, 1);
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.confirm_label.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.cancel_label.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.action_id.push('!');
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.disclosure = None;
        assert_changes_hash(value, baseline);
        let mut value = original.clone();
        value.content.expires_at = None;
        assert_changes_hash(value, baseline);
        let mut value = original;
        value.content.confirm_payload = None;
        assert_changes_hash(value, baseline);
    }

    #[test]
    fn oversized_exact_commitment_is_rejected_before_attestation() {
        let mut value = fixture();
        value.content.rows = (0..32)
            .map(|index| ActionCardRow {
                label: format!("row-{index}"),
                value: "x".repeat(4_096),
            })
            .collect();
        assert!(ai_app_card_content_commitment_hash_v1(&value).is_err());
    }
}

#[cfg(test)]
mod private_match_source_commitment_tests {
    use super::*;

    #[derive(CandidType, Deserialize, Debug, PartialEq, Eq)]
    enum LegacyCardCapabilityScope {
        #[serde(rename = "private_context")]
        PrivateContext,
    }

    #[test]
    fn legacy_one_tag_card_scope_decoder_remains_compatible() {
        let bytes = candid::encode_one(AiAppCardCapabilityScope::PrivateContext).unwrap();
        let decoded: LegacyCardCapabilityScope = candid::decode_one(&bytes).unwrap();
        assert_eq!(decoded, LegacyCardCapabilityScope::PrivateContext);
    }

    #[test]
    fn frozen_utf8_length_delimited_source_digest() {
        assert_eq!(
            hex::encode(ai_app_private_match_source_hash_v1("School expense 350 EGP")),
            "31c494e1ee6b6f60ce0721675f922496dea4bce13acb276d674c55bf53e1ec89"
        );
    }

    #[test]
    fn exact_source_bytes_are_bound() {
        let baseline = ai_app_private_match_source_hash_v1("school expense");
        assert_ne!(baseline, ai_app_private_match_source_hash_v1("School expense"));
        assert_ne!(baseline, ai_app_private_match_source_hash_v1("school expense "));
        assert_ne!(baseline, ai_app_private_match_source_hash_v1("school\0expense"));
    }
}
