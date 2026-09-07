use crate::client;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::wasms;
use crate::{TestEnv, User};
use ai_app_verifier_canister::c2c_verify_ai_app_v2::{self, ManifestCommitmentV2, VerificationBindingV2};
use candid::{CandidType, Principal};
use ecies_payload::EciesEnvelope;
use p256::SecretKey;
use p256::elliptic_curve::Generate;
use p256::pkcs8::{EncodePrivateKey, EncodePublicKey};
use pocket_ic::PocketIc;
use rand::SeedableRng;
use rand::rngs::StdRng;
use serde::Serialize;
use serde_bytes::ByteBuf;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    ActionCardContentInitial, ActionCardResponse, ActionCardRow, AiActionCardRowTemplate, AiActionCardTemplate,
    AiActionDefinition, AiActionRecipientScope, AiAppManifest, AiAppRegistration, AiAppSurface, CanisterId, Chat, ChatId,
    Empty, MessageContentInitial, SurfaceDisplay,
};

const ACTION_ID: &str = "sample.confirm";
const CONFIRM_PAYLOAD: &[u8] = br#"{"amount":"$20"}"#;

pub(crate) fn card_content_fixture() -> types::AiAppCardContentV1 {
    types::AiAppCardContentV1 {
        title: "Review operation".to_string(),
        rows: vec![ActionCardRow {
            label: "Amount".to_string(),
            value: "$20".to_string(),
        }],
        confirm_label: "Confirm".to_string(),
        cancel_label: "Cancel".to_string(),
        action_id: ACTION_ID.to_string(),
        disclosure: None,
        expires_at: None,
        confirm_payload: Some(ByteBuf::from(CONFIRM_PAYLOAD.to_vec())),
    }
}

#[derive(CandidType, Serialize)]
struct NeutralVerifierInit {
    name: String,
    owner: Principal,
    vouched: bool,
    expected_v2: Option<VerificationBindingV2>,
    accepted_card_content: Option<types::AiAppCardContentV1>,
    accepted_confirmation_payload: Option<Vec<u8>>,
}

pub(crate) struct Recipient {
    pub(crate) pk_pem: String,
    pub(crate) sk_pem: String,
    pub(crate) fingerprint: [u8; 32],
}

pub(crate) fn new_recipient(rng: &mut StdRng) -> Recipient {
    let sk = SecretKey::generate_from_rng(rng);
    let pk_pem = sk.public_key().to_public_key_pem(Default::default()).unwrap();
    let sk_pem = sk.to_pkcs8_pem(Default::default()).unwrap().to_string();
    let fingerprint = ecies_payload::key_fingerprint(&pk_pem).unwrap();
    Recipient {
        pk_pem,
        sk_pem,
        fingerprint,
    }
}

pub(crate) struct GroupSetup {
    pub(crate) user_a: User,
    pub(crate) user_b: User,
    pub(crate) group_id: ChatId,
    pub(crate) group_lui: CanisterId,
    pub(crate) inbox: CanisterId,
    pub(crate) app: AiAppRegistration,
}

pub(crate) fn setup(env: &mut PocketIc, canister_ids: &crate::CanisterIds, controller: Principal) -> GroupSetup {
    setup_with_recipient_scope(env, canister_ids, controller, false)
}

pub(crate) fn setup_app_authorized(env: &mut PocketIc, canister_ids: &crate::CanisterIds, controller: Principal) -> GroupSetup {
    setup_with_recipient_scope(env, canister_ids, controller, true)
}

fn setup_with_recipient_scope(
    env: &mut PocketIc,
    canister_ids: &crate::CanisterIds,
    controller: Principal,
    app_authorized: bool,
) -> GroupSetup {
    activate_initial_action_signing_key_for_local_test(env, canister_ids.user_index, controller);
    let user_a = client::register_diamond_user(env, canister_ids, controller);
    let user_b = client::register_diamond_user(env, canister_ids, controller);
    let group_id = client::user::happy_path::create_group(env, &user_a, &random_string(), true, true);
    tick_many(env, 3);
    let group_lui = client::group::happy_path::local_user_index(env, group_id);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &user_a,
        group_lui,
        group_id,
        vec![(user_b.user_id, user_b.principal)],
    );
    // Allocate the destination first, register the manifest to obtain its immutable app id, then
    // install the inbox bound to exactly that id before publication verifies the binding.
    let inbox = client::create_canister(env, controller);
    let draft = if app_authorized {
        register_app_authorized_per_user_app(env, canister_ids.user_index, controller, &user_a, Some(inbox))
    } else {
        register_per_user_app(env, canister_ids.user_index, controller, &user_a, Some(inbox))
    };
    install_inbox_at(env, controller, canister_ids, inbox, draft.id, canister_ids.user_index);
    let app = publish_registered_app(env, canister_ids.user_index, &user_a, draft.id);
    client::group::happy_path::set_ai_app_enabled(env, user_a.principal, group_id, app.id, true);
    GroupSetup {
        user_a,
        user_b,
        group_id,
        group_lui,
        inbox,
        app,
    }
}

/// PocketIC is the loopback-only exception to remote pin provisioning. Even here the fixture first
/// derives and retains the staged key id, then performs the separate governance activation and
/// verifies that the exact pinned id became active. Production consumers must provision the pin
/// through an independently authenticated channel instead of trusting this discovery query.
fn activate_initial_action_signing_key_for_local_test(env: &mut PocketIc, user_index: CanisterId, controller: Principal) {
    // UserIndex creates its initial staged key from an asynchronous raw_rand callback. Drive the
    // lifecycle timer and management-canister callback rounds before treating the keyring as ready.
    tick_many(env, 10);
    let response: user_index_canister::action_signing_keys::Response =
        client::execute_query(env, Principal::anonymous(), user_index, "action_signing_keys", &Empty {});
    let user_index_canister::action_signing_keys::Response::Success(keys) = response else {
        panic!("fresh UserIndex must expose one staged action-signing key")
    };
    assert_eq!(keys.signature_version, ecies_payload::ACTION_INBOX_SIGNATURE_VERSION_V4);
    assert_eq!(keys.purpose, "action_inbox_deposit");
    if keys.keys.iter().any(|key| {
        matches!(
            key.status,
            user_index_canister::action_signing_keys::ActionSigningKeyStatus::Active
        )
    }) {
        return;
    }

    let staged = keys
        .keys
        .into_iter()
        .find(|key| {
            matches!(
                key.status,
                user_index_canister::action_signing_keys::ActionSigningKeyStatus::Staged
            )
        })
        .expect("fresh UserIndex action-signing key must remain staged before explicit activation");
    let pinned_key_id = staged.key_id;
    assert_eq!(
        pinned_key_id.as_ref(),
        ecies_payload::action_signing_key_id(&staged.public_key_pem).unwrap(),
        "the local test pin must match the advertised public key"
    );

    let activation: user_index_canister::activate_action_signing_key::Response = client::execute_update(
        env,
        controller,
        user_index,
        "activate_action_signing_key",
        &user_index_canister::activate_action_signing_key::Args {
            key_id: pinned_key_id.clone(),
        },
    );
    assert!(matches!(
        activation,
        user_index_canister::activate_action_signing_key::Response::Success
    ));

    let after: user_index_canister::action_signing_keys::Response =
        client::execute_query(env, Principal::anonymous(), user_index, "action_signing_keys", &Empty {});
    let user_index_canister::action_signing_keys::Response::Success(after) = after else {
        panic!("activated local action-signing key must remain discoverable")
    };
    assert!(after.keys.into_iter().any(|key| {
        key.key_id == pinned_key_id
            && matches!(
                key.status,
                user_index_canister::action_signing_keys::ActionSigningKeyStatus::Active
            )
    }));
}

pub(crate) fn publish_per_user_app(
    env: &mut PocketIc,
    user_index: CanisterId,
    controller: Principal,
    owner: &User,
    inbox: Option<CanisterId>,
) -> AiAppRegistration {
    let draft = register_per_user_app(env, user_index, controller, owner, inbox);
    publish_registered_app(env, user_index, owner, draft.id)
}

pub(crate) fn register_per_user_app(
    env: &mut PocketIc,
    user_index: CanisterId,
    controller: Principal,
    owner: &User,
    inbox: Option<CanisterId>,
) -> AiAppRegistration {
    register_per_user_app_with_scope(env, user_index, controller, owner, inbox, None)
}

pub(crate) fn register_app_authorized_per_user_app(
    env: &mut PocketIc,
    user_index: CanisterId,
    controller: Principal,
    owner: &User,
    inbox: Option<CanisterId>,
) -> AiAppRegistration {
    register_per_user_app_with_scope(
        env,
        user_index,
        controller,
        owner,
        inbox,
        Some(AiActionRecipientScope::AppAuthorized),
    )
}

fn register_per_user_app_with_scope(
    env: &mut PocketIc,
    user_index: CanisterId,
    controller: Principal,
    owner: &User,
    inbox: Option<CanisterId>,
    recipient_scope: Option<AiActionRecipientScope>,
) -> AiAppRegistration {
    let name = random_string();
    let verifier = client::create_canister(env, controller);
    let manifest = AiAppManifest {
        name,
        description: "confirmer-bound delivery fixture".to_string(),
        icon_url: None,
        app_canister_id: Some(verifier),
        inbox_canister_id: inbox,
        consumer_public_key: String::new(),
        per_user_keys: true,
        actions: vec![AiActionDefinition {
            name: ACTION_ID.to_string(),
            description: "Confirm a neutral operation".to_string(),
            prompt_template: "Return a value".to_string(),
            response_schema: r#"{"type":"object"}"#.to_string(),
            card: AiActionCardTemplate {
                title: "Review operation".to_string(),
                confirm_label: "Confirm".to_string(),
                cancel_label: "Cancel".to_string(),
                rows: vec![AiActionCardRowTemplate {
                    field: "amount".to_string(),
                    label: "Amount".to_string(),
                }],
                disclosure: None,
            },
            endpoint: "https://app.example/confirm".to_string(),
            consumer_public_key: None,
            recipient_scope,
            rules: vec![],
            accepts_image: false,
        }],
        surfaces: vec![AiAppSurface {
            kind: "card".to_string(),
            url: "https://app.example/card".to_string(),
            display: SurfaceDisplay::Sheet,
        }],
    };
    let app_id = client::user_index::happy_path::register_ai_app(env, owner.principal, user_index, manifest);
    let draft = current_app(env, user_index, owner.principal, app_id);
    client::install_canister(
        env,
        controller,
        verifier,
        wasms::AI_APP_VERIFIER_TEST.clone(),
        NeutralVerifierInit {
            name: draft.manifest.name.clone(),
            owner: owner.user_id.as_principal(),
            vouched: true,
            expected_v2: Some(verification_binding(user_index, &draft)),
            accepted_card_content: Some(card_content_fixture()),
            accepted_confirmation_payload: Some(CONFIRM_PAYLOAD.to_vec()),
        },
    );
    draft
}

pub(crate) fn publish_registered_app(
    env: &mut PocketIc,
    user_index: CanisterId,
    owner: &User,
    app_id: types::AiAppId,
) -> AiAppRegistration {
    let published: user_index_canister::publish_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        user_index,
        "publish_ai_app_msgpack",
        &user_index_canister::publish_ai_app::Args { app_id },
    );
    assert!(
        matches!(published, user_index_canister::publish_ai_app::Response::Success),
        "neutral verifier must publish the app: {published:?}"
    );
    current_app(env, user_index, owner.principal, app_id)
}

fn current_app(env: &PocketIc, user_index: CanisterId, owner: Principal, app_id: types::AiAppId) -> AiAppRegistration {
    let response: user_index_canister::ai_apps::Response = client::execute_msgpack_query(
        env,
        owner,
        user_index,
        "ai_apps_msgpack",
        &user_index_canister::ai_apps::Args {},
    );
    let user_index_canister::ai_apps::Response::Success(result) = response;
    result
        .apps
        .into_iter()
        .find(|app| app.id == app_id)
        .expect("owner must see the app with its current revision")
}

fn verification_binding(user_index: CanisterId, app: &AiAppRegistration) -> VerificationBindingV2 {
    let canonical_name = c2c_verify_ai_app_v2::canonical_app_name(&app.manifest.name).unwrap();
    let commitment = ManifestCommitmentV2 {
        user_index_canister_id: user_index,
        app_id: app.id,
        app_revision: app.updated,
        owner: app.owner.as_principal(),
        canonical_name: canonical_name.clone(),
        manifest: app.manifest.clone(),
    };
    VerificationBindingV2 {
        user_index_canister_id: user_index,
        app_id: app.id,
        app_revision: app.updated,
        owner: app.owner.as_principal(),
        canonical_name,
        app_canister_id: app.manifest.app_canister_id.unwrap(),
        inbox_canister_id: app.manifest.inbox_canister_id,
        manifest_hash: c2c_verify_ai_app_v2::manifest_hash_v2(&commitment).unwrap(),
    }
}

#[derive(CandidType, Serialize)]
struct ProxyClaimLinkCodeArgs {
    user_index_canister_id: CanisterId,
    args: user_index_canister::c2c_claim_ai_app_link_code::Args,
}

#[derive(CandidType, Serialize)]
struct ProxyRevokeUserKeyArgs {
    user_index_canister_id: CanisterId,
    args: user_index_canister::revoke_ai_app_user_key::Args,
}

#[derive(CandidType, Serialize)]
struct ConfigureAuthorizedRecipientsArgs {
    recipients: Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>,
    subsequent_recipients: Option<Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>>,
}

pub(crate) fn configure_authorized_recipients(
    env: &mut PocketIc,
    app_canister: CanisterId,
    recipients: Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>,
) {
    configure_authorized_recipient_responses(env, app_canister, recipients, None);
}

pub(crate) fn configure_authorized_recipient_responses(
    env: &mut PocketIc,
    app_canister: CanisterId,
    recipients: Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>,
    subsequent_recipients: Option<Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>>,
) {
    let _: () = client::execute_update(
        env,
        Principal::anonymous(),
        app_canister,
        "configure_authorized_recipients",
        &ConfigureAuthorizedRecipientsArgs {
            recipients,
            subsequent_recipients,
        },
    );
}

pub(crate) fn authorized_recipient_from_claim(
    claim: &user_index_canister::c2c_claim_ai_app_link_code::SuccessResult,
    consumer_public_key: String,
) -> ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient {
    ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient {
        app_subject: claim.app_subject.clone(),
        subject_version: claim.subject_version,
        consumer_queue_selector: claim.consumer_queue_selector.clone(),
        consumer_queue_selector_version: claim.consumer_queue_selector_version,
        consumer_public_key,
        app_user_key_version: claim.key_version,
    }
}

fn ordered_authorized_recipients(
    mut recipients: Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient>,
) -> Vec<ai_app_verifier_canister::c2c_authorize_ai_action_recipients::AuthorizedRecipient> {
    recipients.sort_by(|left, right| left.app_subject.as_ref().cmp(right.app_subject.as_ref()));
    recipients
}

pub(crate) fn claim_link_code_via_app(
    env: &mut PocketIc,
    app_canister: CanisterId,
    user_index: CanisterId,
    args: user_index_canister::c2c_claim_ai_app_link_code::Args,
) -> user_index_canister::c2c_claim_ai_app_link_code::Response {
    client::execute_update(
        env,
        Principal::anonymous(),
        app_canister,
        "proxy_c2c_claim_ai_app_link_code",
        &ProxyClaimLinkCodeArgs {
            user_index_canister_id: user_index,
            args,
        },
    )
}

pub(crate) fn revoke_user_key_via_app(
    env: &mut PocketIc,
    app_canister: CanisterId,
    user_index: CanisterId,
    args: user_index_canister::revoke_ai_app_user_key::Args,
) -> user_index_canister::revoke_ai_app_user_key::Response {
    client::execute_update(
        env,
        Principal::anonymous(),
        app_canister,
        "proxy_revoke_ai_app_user_key",
        &ProxyRevokeUserKeyArgs {
            user_index_canister_id: user_index,
            args,
        },
    )
}

pub(crate) fn link_key(
    env: &mut PocketIc,
    user_index: CanisterId,
    user: &User,
    app: &AiAppRegistration,
    public_key: String,
) -> [u8; 32] {
    let claim = link_key_claim(env, user_index, user, app, public_key);
    selector_from_claim(&claim)
}

pub(crate) fn link_key_claim(
    env: &mut PocketIc,
    user_index: CanisterId,
    user: &User,
    app: &AiAppRegistration,
    public_key: String,
) -> user_index_canister::c2c_claim_ai_app_link_code::SuccessResult {
    let code = match client::execute_msgpack_update::<_, user_index_canister::create_ai_app_link_code::Response>(
        env,
        user.principal,
        user_index,
        "create_ai_app_link_code_msgpack",
        &user_index_canister::create_ai_app_link_code::Args { app_id: app.id },
    ) {
        user_index_canister::create_ai_app_link_code::Response::Success(result) => result.code,
        other => panic!("user must be able to create an app link code: {other:?}"),
    };
    let app_canister_id = app
        .manifest
        .app_canister_id
        .expect("published per-user app must pin its app canister");
    let claim = claim_link_code_via_app(
        env,
        app_canister_id,
        user_index,
        user_index_canister::c2c_claim_ai_app_link_code::Args { code, public_key },
    );
    let user_index_canister::c2c_claim_ai_app_link_code::Response::Success(result) = claim else {
        panic!("exact registered app canister must claim the link code: {claim:?}")
    };
    assert_eq!(result.app_id, app.id);
    assert_eq!(result.app_revision, app.updated);
    assert_eq!(result.app_canister_id, app_canister_id);
    assert_eq!(
        result.subject_version,
        user_index_canister::c2c_claim_ai_app_link_code::APP_SUBJECT_VERSION_V1
    );
    assert_eq!(result.app_subject.len(), 32);
    assert_eq!(
        result.consumer_queue_selector_version,
        user_index_canister::c2c_claim_ai_app_link_code::CONSUMER_QUEUE_SELECTOR_VERSION_V1
    );
    assert_eq!(result.consumer_queue_selector.len(), 32);
    result
}

pub(crate) fn selector_from_claim(claim: &user_index_canister::c2c_claim_ai_app_link_code::SuccessResult) -> [u8; 32] {
    claim
        .consumer_queue_selector
        .as_ref()
        .try_into()
        .expect("v1 consumer queue selector must be 32 bytes")
}

#[expect(
    clippy::too_many_arguments,
    reason = "Security tests vary each forged routing field independently"
)]
pub(crate) fn post_card(
    env: &mut PocketIc,
    user_index: CanisterId,
    user: &User,
    group_id: ChatId,
    app: &AiAppRegistration,
    forged_recipient: Option<String>,
    forged_recipients: Vec<String>,
    forged_inbox: Option<CanisterId>,
) -> types::MessageId {
    let message_id = random_from_u128();
    let fixture = card_content_fixture();
    let mut card = ActionCardContentInitial {
        title: fixture.title,
        rows: fixture.rows,
        confirm_label: fixture.confirm_label,
        cancel_label: fixture.cancel_label,
        action_id: fixture.action_id,
        app_id: Some(app.id),
        app_revision: Some(app.updated),
        app_provenance: None,
        disclosure: fixture.disclosure,
        expires_at: fixture.expires_at,
        recipient_public_key: forged_recipient,
        recipient_public_keys: forged_recipients,
        confirm_payload: fixture.confirm_payload,
        inbox_canister_id: forged_inbox,
    };
    let provenance: user_index_canister::create_ai_app_card_provenance::Response = client::execute_msgpack_update(
        env,
        user.principal,
        user_index,
        "create_ai_app_card_provenance_msgpack",
        &user_index_canister::create_ai_app_card_provenance::Args {
            app_id: app.id,
            app_revision: app.updated,
            action_id: ACTION_ID.to_string(),
            content: (&card).into(),
            chat: types::Chat::Group(group_id),
            thread_root_message_index: None,
            message_id,
        },
    );
    let user_index_canister::create_ai_app_card_provenance::Response::Success(provenance) = provenance else {
        panic!("exact card fixture must receive provenance: {provenance:?}")
    };
    card.app_provenance = Some(provenance.provenance);
    client::group::happy_path::send_message(
        env,
        user,
        group_id,
        None,
        MessageContentInitial::ActionCard(card),
        None,
        Some(message_id),
    );
    message_id
}

pub(crate) fn confirm_raw(
    env: &mut PocketIc,
    user: &User,
    group_id: ChatId,
    message_id: types::MessageId,
) -> group_canister::respond_to_action_card::Response {
    client::execute_msgpack_update(
        env,
        user.principal,
        group_id.into(),
        "respond_to_action_card_msgpack",
        &group_canister::respond_to_action_card::Args {
            thread_root_message_index: None,
            message_id,
            response: ActionCardResponse::Confirm,
            confirm_payload_override: None,
            confirmation_grant: None,
        },
    )
}

pub(crate) fn confirm(env: &mut PocketIc, user: &User, group_id: ChatId, message_id: types::MessageId) {
    let response = confirm_raw(env, user, group_id, message_id);
    assert!(
        matches!(response, group_canister::respond_to_action_card::Response::Success(_)),
        "confirm failed: {response:?}"
    );
    tick_many(env, 10);
}

#[test]
fn app_authorized_route_delivers_to_exact_recipients_after_an_old_confirmation_time() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup_app_authorized(env, canister_ids, *controller);
    let unrelated = client::register_diamond_user(env, canister_ids, *controller);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        &setup.user_a,
        setup.group_lui,
        setup.group_id,
        vec![(unrelated.user_id, unrelated.principal)],
    );
    tick_many(env, 3);
    let mut rng = StdRng::seed_from_u64(4301);
    let recipient_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let unrelated_recipient = new_recipient(&mut rng);
    let claim_a = link_key_claim(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let claim_b = link_key_claim(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let unrelated_claim = link_key_claim(
        env,
        canister_ids.user_index,
        &unrelated,
        &setup.app,
        unrelated_recipient.pk_pem.clone(),
    );
    let selector_a = selector_from_claim(&claim_a);
    let selector_b = selector_from_claim(&claim_b);
    let unrelated_selector = selector_from_claim(&unrelated_claim);
    let authorized = ordered_authorized_recipients(vec![
        authorized_recipient_from_claim(&claim_a, recipient_a.pk_pem.clone()),
        authorized_recipient_from_claim(&claim_b, recipient_b.pk_pem.clone()),
    ]);
    let app_canister = setup.app.manifest.app_canister_id.unwrap();
    configure_authorized_recipients(env, app_canister, Vec::new());
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![],
        None,
    );

    // The failed exact attempt reserves one immutable confirmation lease/time. Retrying that same
    // lease after the old callback TTL must use a fresh route authorization clock without forking
    // the card/delivery identity.
    let unavailable = confirm_raw(env, &setup.user_b, setup.group_id, message_id);
    assert!(
        matches!(unavailable, group_canister::respond_to_action_card::Response::Error(_)),
        "an app with no private recipient decision must fail closed: {unavailable:?}"
    );
    configure_authorized_recipients(env, app_canister, authorized);
    env.advance_time(Duration::from_secs(6 * 60));
    tick_many(env, 3);
    confirm(env, &setup.user_b, setup.group_id, message_id);

    let actions_a = fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a);
    let actions_b = fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b);
    assert_eq!(actions_a.len(), 1, "the linked account owner must receive its exact route");
    assert_eq!(actions_b.len(), 1, "the confirmer must receive its exact route");
    assert_eq!(
        fetch_actions(env, unrelated.principal, setup.inbox, &unrelated_selector).len(),
        0,
        "an unrelated linked chat member must not be added implicitly"
    );
    assert_ne!(
        actions_a[0].ephemeral_public_key, actions_b[0].ephemeral_public_key,
        "each distinct recipient key must receive an independently randomized envelope"
    );
    let plaintext_a = decrypt(&actions_a[0], &recipient_a.sk_pem).expect("first authorized recipient must decrypt");
    let plaintext_b = decrypt(&actions_b[0], &recipient_b.sk_pem).expect("second authorized recipient must decrypt");
    assert!(decrypt(&actions_a[0], &recipient_b.sk_pem).is_err());
    assert!(decrypt(&actions_b[0], &recipient_a.sk_pem).is_err());
    for plaintext in [plaintext_a, plaintext_b] {
        let json: serde_json::Value = serde_json::from_slice(&plaintext).unwrap();
        assert_eq!(json["context"]["appId"], setup.app.id);
        assert_eq!(json["context"]["actionId"], ACTION_ID);
    }
    let _committed_retry = confirm_raw(env, &setup.user_b, setup.group_id, message_id);
    tick_many(env, 3);
    assert_eq!(fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a).len(), 1);
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 1);
}

#[test]
fn app_authorized_recipient_change_and_stale_key_fail_atomically() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup_app_authorized(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4302);
    let old_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let claim_a = link_key_claim(env, canister_ids.user_index, &setup.user_a, &setup.app, old_a.pk_pem.clone());
    let claim_b = link_key_claim(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let old_selector_a = selector_from_claim(&claim_a);
    let selector_b = selector_from_claim(&claim_b);
    let authorized_a = authorized_recipient_from_claim(&claim_a, old_a.pk_pem.clone());
    let authorized_b = authorized_recipient_from_claim(&claim_b, recipient_b.pk_pem.clone());
    let exact = ordered_authorized_recipients(vec![authorized_a.clone(), authorized_b.clone()]);
    let app_canister = setup.app.manifest.app_canister_id.unwrap();

    // Route authorization returns A+B, but pre-deposit authorization omits A. Even B's already
    // encrypted envelope must not be stored because recipient fan-out is all-or-none.
    configure_authorized_recipient_responses(env, app_canister, exact.clone(), Some(vec![authorized_b]));
    let changed_message = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![],
        None,
    );
    let changed = confirm_raw(env, &setup.user_b, setup.group_id, changed_message);
    assert!(
        matches!(changed, group_canister::respond_to_action_card::Response::Error(_)),
        "a changed second callback must reject the whole confirmation: {changed:?}"
    );
    tick_many(env, 10);
    assert_eq!(
        fetch_actions(env, setup.user_a.principal, setup.inbox, &old_selector_a).len(),
        0
    );
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 0);

    // Reconfigure a stable callback, then rotate A's registered app key without updating the app's
    // private recipient row. The stale public-key/version claim must fail before any envelope lands.
    configure_authorized_recipients(env, app_canister, exact);
    let current_a = new_recipient(&mut rng);
    let current_claim_a = link_key_claim(env, canister_ids.user_index, &setup.user_a, &setup.app, current_a.pk_pem);
    let current_selector_a = selector_from_claim(&current_claim_a);
    let stale_message = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![],
        None,
    );
    let stale = confirm_raw(env, &setup.user_b, setup.group_id, stale_message);
    assert!(
        matches!(stale, group_canister::respond_to_action_card::Response::Error(_)),
        "a rotated recipient key must reject the whole confirmation: {stale:?}"
    );
    tick_many(env, 10);
    assert_eq!(
        fetch_actions(env, setup.user_a.principal, setup.inbox, &old_selector_a).len(),
        0
    );
    assert_eq!(
        fetch_actions(env, setup.user_a.principal, setup.inbox, &current_selector_a).len(),
        0
    );
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 0);
}

#[test]
fn app_authorized_direct_chat_delivers_exact_independent_envelopes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup_app_authorized(env, canister_ids, *controller);
    let unrelated = client::register_diamond_user(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4303);
    let recipient_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let unrelated_recipient = new_recipient(&mut rng);
    let claim_a = link_key_claim(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let claim_b = link_key_claim(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let unrelated_claim = link_key_claim(
        env,
        canister_ids.user_index,
        &unrelated,
        &setup.app,
        unrelated_recipient.pk_pem.clone(),
    );
    let selector_a = selector_from_claim(&claim_a);
    let selector_b = selector_from_claim(&claim_b);
    let unrelated_selector = selector_from_claim(&unrelated_claim);
    configure_authorized_recipients(
        env,
        setup.app.manifest.app_canister_id.unwrap(),
        ordered_authorized_recipients(vec![
            authorized_recipient_from_claim(&claim_a, recipient_a.pk_pem.clone()),
            authorized_recipient_from_claim(&claim_b, recipient_b.pk_pem.clone()),
        ]),
    );

    let message_id = random_from_u128();
    let fixture = card_content_fixture();
    let mut card = ActionCardContentInitial {
        title: fixture.title,
        rows: fixture.rows,
        confirm_label: fixture.confirm_label,
        cancel_label: fixture.cancel_label,
        action_id: fixture.action_id,
        app_id: Some(setup.app.id),
        app_revision: Some(setup.app.updated),
        app_provenance: None,
        disclosure: fixture.disclosure,
        expires_at: fixture.expires_at,
        recipient_public_key: None,
        recipient_public_keys: Vec::new(),
        confirm_payload: fixture.confirm_payload,
        inbox_canister_id: None,
    };
    let provenance: user_index_canister::create_ai_app_card_provenance::Response = client::execute_msgpack_update(
        env,
        setup.user_a.principal,
        canister_ids.user_index,
        "create_ai_app_card_provenance_msgpack",
        &user_index_canister::create_ai_app_card_provenance::Args {
            app_id: setup.app.id,
            app_revision: setup.app.updated,
            action_id: ACTION_ID.to_string(),
            content: (&card).into(),
            chat: Chat::Direct(setup.user_b.user_id.into()),
            thread_root_message_index: None,
            message_id,
        },
    );
    let user_index_canister::create_ai_app_card_provenance::Response::Success(provenance) = provenance else {
        panic!("exact direct-card fixture must receive provenance: {provenance:?}")
    };
    card.app_provenance = Some(provenance.provenance);
    client::user::happy_path::send_message(
        env,
        &setup.user_a,
        setup.user_b.user_id,
        None,
        MessageContentInitial::ActionCard(card),
        None,
        Some(message_id),
    );

    let confirmed: user_canister::respond_to_action_card::Response = client::execute_msgpack_update(
        env,
        setup.user_a.principal,
        setup.user_a.canister(),
        "respond_to_action_card_msgpack",
        &user_canister::respond_to_action_card::Args {
            user_id: setup.user_b.user_id,
            thread_root_message_index: None,
            message_id,
            response: ActionCardResponse::Confirm,
            confirm_payload_override: None,
            confirmation_grant: None,
        },
    );
    assert!(
        matches!(confirmed, user_canister::respond_to_action_card::Response::Success(_)),
        "direct A-B confirmation must succeed: {confirmed:?}"
    );
    tick_many(env, 10);

    let actions_a = fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a);
    let actions_b = fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b);
    assert_eq!(actions_a.len(), 1);
    assert_eq!(actions_b.len(), 1);
    assert_eq!(
        fetch_actions(env, unrelated.principal, setup.inbox, &unrelated_selector).len(),
        0,
        "an unrelated linked user must not receive a direct-chat account action"
    );
    assert_ne!(actions_a[0].ephemeral_public_key, actions_b[0].ephemeral_public_key);
    assert!(decrypt(&actions_a[0], &recipient_a.sk_pem).is_ok());
    assert!(decrypt(&actions_b[0], &recipient_b.sk_pem).is_ok());
    assert!(decrypt(&actions_a[0], &recipient_b.sk_pem).is_err());
    assert!(decrypt(&actions_b[0], &recipient_a.sk_pem).is_err());

    let _exact_retry: user_canister::respond_to_action_card::Response = client::execute_msgpack_update(
        env,
        setup.user_a.principal,
        setup.user_a.canister(),
        "respond_to_action_card_msgpack",
        &user_canister::respond_to_action_card::Args {
            user_id: setup.user_b.user_id,
            thread_root_message_index: None,
            message_id,
            response: ActionCardResponse::Confirm,
            confirm_payload_override: None,
            confirmation_grant: None,
        },
    );
    tick_many(env, 3);
    assert_eq!(fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a).len(), 1);
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 1);
}

#[test]
fn confirm_uses_manifest_inbox_and_actual_confirmer_selector_not_card_routing() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4242);
    let recipient_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let attacker = new_recipient(&mut rng);
    let selector_a = link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let selector_b = link_key(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let forged_inbox = client::create_canister(env, *controller);
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        Some(attacker.pk_pem.clone()),
        vec![attacker.pk_pem.clone()],
        Some(forged_inbox),
    );
    confirm(env, &setup.user_b, setup.group_id, message_id);

    let actions_a = fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a);
    let actions_b = fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b);
    assert_eq!(actions_a.len(), 0, "a nonconfirmer must not receive a delivery");
    assert_eq!(actions_b.len(), 1);
    assert_eq!(
        fetch_actions(env, setup.user_a.principal, setup.inbox, &attacker.fingerprint).len(),
        0
    );
    let plaintext = decrypt(&actions_b[0], &recipient_b.sk_pem).expect("actual confirmer must decrypt its envelope");
    let json: serde_json::Value = serde_json::from_slice(&plaintext).unwrap();
    assert_eq!(json["context"]["appId"], setup.app.id);
    assert_eq!(json["context"]["appRevision"], setup.app.updated);
    assert_eq!(json["context"]["actionId"], ACTION_ID);
    assert!(
        json["context"].get("confirmedBy").is_none(),
        "raw confirmer principal must not leak into the app-scoped envelope"
    );
}

#[test]
fn app_key_lookup_rejects_browser_callers_and_accepts_local_user_index() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4243);
    let recipient_a = new_recipient(&mut rng);
    link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let args = user_index_canister::ai_app_user_keys::Args {
        app_id: setup.app.id,
        user_ids: vec![setup.user_a.user_id, setup.user_b.user_id],
    };
    let browser = env.query_call(
        canister_ids.user_index,
        setup.user_b.principal,
        "ai_app_user_keys_msgpack",
        msgpack::serialize_then_unwrap(&args),
    );
    assert!(
        browser.is_err(),
        "a browser identity must not enumerate another user's app key"
    );

    let response: user_index_canister::ai_app_user_keys::Response = client::execute_msgpack_query(
        env,
        setup.group_lui,
        canister_ids.user_index,
        "ai_app_user_keys_msgpack",
        &args,
    );
    let user_index_canister::ai_app_user_keys::Response::Success(result) = response;
    assert_eq!(result.keys.len(), 1);
    assert_eq!(result.keys[0].user_id, setup.user_a.user_id);
    assert_eq!(result.keys[0].public_key, recipient_a.pk_pem);
}

#[test]
fn confirmer_key_rotation_after_post_delivers_only_to_current_selector() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4244);
    let old_key = new_recipient(&mut rng);
    let current_key = new_recipient(&mut rng);
    let nonconfirmer_key = new_recipient(&mut rng);
    let nonconfirmer_selector = link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        nonconfirmer_key.pk_pem.clone(),
    );
    let old_selector = link_key(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        old_key.pk_pem.clone(),
    );
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        Some(nonconfirmer_key.pk_pem.clone()),
        vec![],
        None,
    );
    let current_selector = link_key(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        current_key.pk_pem.clone(),
    );
    confirm(env, &setup.user_b, setup.group_id, message_id);
    assert_eq!(
        fetch_actions(env, setup.user_b.principal, setup.inbox, &old_selector).len(),
        0
    );
    assert_eq!(
        fetch_actions(env, setup.user_b.principal, setup.inbox, &current_selector).len(),
        1
    );
    assert_eq!(
        fetch_actions(env, setup.user_a.principal, setup.inbox, &nonconfirmer_selector).len(),
        0
    );
}

#[test]
fn removed_member_cannot_confirm_and_current_member_gets_the_only_delivery() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4245);
    let recipient_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let selector_a = link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let selector_b = link_key(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![recipient_b.pk_pem.clone()],
        None,
    );
    let removed = client::group::remove_participant(
        env,
        setup.user_a.principal,
        setup.group_id.into(),
        &group_canister::remove_participant::Args {
            user_id: setup.user_b.user_id,
        },
    );
    assert!(matches!(removed, group_canister::remove_participant::Response::Success));
    tick_many(env, 3);
    let removed_confirm = env.update_call(
        setup.group_id.into(),
        setup.user_b.principal,
        "respond_to_action_card_msgpack",
        msgpack::serialize_then_unwrap(&group_canister::respond_to_action_card::Args {
            thread_root_message_index: None,
            message_id,
            response: ActionCardResponse::Confirm,
            confirm_payload_override: None,
            confirmation_grant: None,
        }),
    );
    assert!(
        removed_confirm.is_err(),
        "a removed member's ingress must be rejected before card confirmation: {removed_confirm:?}"
    );
    confirm(env, &setup.user_a, setup.group_id, message_id);
    assert_eq!(fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a).len(), 1);
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 0);
}

#[test]
fn malformed_member_key_is_rejected_at_ingress_and_missing_key_fails_atomically() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4246);
    let recipient_a = new_recipient(&mut rng);
    let selector_a = link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let invalid: user_index_canister::set_my_ai_app_key::Response = client::execute_msgpack_update(
        env,
        setup.user_b.principal,
        canister_ids.user_index,
        "set_my_ai_app_key_msgpack",
        &user_index_canister::set_my_ai_app_key::Args {
            app_id: setup.app.id,
            public_key: "-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n".to_string(),
        },
    );
    assert!(matches!(
        invalid,
        user_index_canister::set_my_ai_app_key::Response::InvalidRequest(_)
    ));
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![],
        None,
    );
    let response = confirm_raw(env, &setup.user_b, setup.group_id, message_id);
    assert!(matches!(response, group_canister::respond_to_action_card::Response::Error(_)));
    tick_many(env, 10);
    assert_eq!(fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a).len(), 0);
    let cancel: group_canister::respond_to_action_card::Response = client::execute_msgpack_update(
        env,
        setup.user_b.principal,
        setup.group_id.into(),
        "respond_to_action_card_msgpack",
        &group_canister::respond_to_action_card::Args {
            thread_root_message_index: None,
            message_id,
            response: ActionCardResponse::Cancel,
            confirm_payload_override: None,
            confirmation_grant: None,
        },
    );
    assert!(matches!(cancel, group_canister::respond_to_action_card::Response::Success(_)));
}

#[test]
fn second_member_confirm_does_not_add_another_deposit() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let setup = setup(env, canister_ids, *controller);
    let mut rng = StdRng::seed_from_u64(4247);
    let recipient_a = new_recipient(&mut rng);
    let recipient_b = new_recipient(&mut rng);
    let selector_a = link_key(
        env,
        canister_ids.user_index,
        &setup.user_a,
        &setup.app,
        recipient_a.pk_pem.clone(),
    );
    let selector_b = link_key(
        env,
        canister_ids.user_index,
        &setup.user_b,
        &setup.app,
        recipient_b.pk_pem.clone(),
    );
    let message_id = post_card(
        env,
        canister_ids.user_index,
        &setup.user_a,
        setup.group_id,
        &setup.app,
        None,
        vec![],
        None,
    );
    confirm(env, &setup.user_b, setup.group_id, message_id);
    let second = confirm_raw(env, &setup.user_a, setup.group_id, message_id);
    assert!(!matches!(
        second,
        group_canister::respond_to_action_card::Response::Success(_)
    ));
    tick_many(env, 10);
    assert_eq!(fetch_actions(env, setup.user_a.principal, setup.inbox, &selector_a).len(), 0);
    assert_eq!(fetch_actions(env, setup.user_b.principal, setup.inbox, &selector_b).len(), 1);
}

pub(crate) fn decrypt(
    action: &action_inbox_canister::actions::StoredAction,
    recipient_sk_pem: &str,
) -> Result<Vec<u8>, String> {
    let envelope = EciesEnvelope {
        ephemeral_public_key: action.ephemeral_public_key.clone().into_vec(),
        ciphertext: action.ciphertext.clone().into_vec(),
    };
    ecies_payload::decrypt(&envelope, recipient_sk_pem)
}

pub(crate) fn fetch_actions(
    env: &mut PocketIc,
    sender: Principal,
    inbox: CanisterId,
    fingerprint: &[u8; 32],
) -> Vec<action_inbox_canister::actions::StoredAction> {
    let response = client::action_inbox::actions(
        env,
        sender,
        inbox,
        &action_inbox_canister::actions::Args {
            consumer_key_fingerprint: ByteBuf::from(fingerprint.to_vec()),
            since_id: 0,
            max_results: 100,
        },
    );
    match response {
        action_inbox_canister::actions::Response::Success(result) => result.actions,
        action_inbox_canister::actions::Response::Error(error) => {
            panic!("ActionInbox actions update failed: {error:?}")
        }
    }
}

pub(crate) fn inbox_deposit_fixture(
    fingerprint: [u8; 32],
    identity: [u8; 32],
    payload_hash: [u8; 32],
    created_at: u64,
) -> action_inbox_canister::c2c_notify_actions::ActionDeposit {
    action_inbox_canister::c2c_notify_actions::ActionDeposit {
        idempotency_key: ByteBuf::from(identity.to_vec()),
        payload_hash: ByteBuf::from(payload_hash.to_vec()),
        card_context_hash: ByteBuf::from(vec![8; 32]),
        app_revision: 1,
        action_id: "sample.action".to_string(),
        consumer_key_fingerprint: ByteBuf::from(fingerprint.to_vec()),
        acknowledgement_secret_hash: ByteBuf::from(vec![5; 32]),
        ephemeral_public_key: ByteBuf::from(vec![4; 65]),
        ciphertext: ByteBuf::from(b"opaque-ciphertext".to_vec()),
        signature_version: ecies_payload::ACTION_INBOX_SIGNATURE_VERSION_V4,
        signing_key_id: ByteBuf::from(vec![
            9;
            action_inbox_canister::c2c_notify_actions::ACTION_SIGNING_KEY_ID_BYTES
        ]),
        oc_signature: ByteBuf::from(vec![0; 64]),
        created_at,
    }
}

pub(crate) fn install_inbox(
    env: &mut PocketIc,
    controller: Principal,
    canister_ids: &crate::CanisterIds,
    app_id: types::AiAppId,
    authorized_depositor: CanisterId,
) -> CanisterId {
    let inbox = client::create_canister(env, controller);
    install_inbox_at(env, controller, canister_ids, inbox, app_id, authorized_depositor);
    inbox
}

pub(crate) fn install_inbox_at(
    env: &mut PocketIc,
    controller: Principal,
    canister_ids: &crate::CanisterIds,
    inbox: CanisterId,
    app_id: types::AiAppId,
    authorized_depositor: CanisterId,
) {
    client::install_canister(
        env,
        controller,
        inbox,
        wasms::ACTION_INBOX.clone(),
        action_inbox_canister::init::Args {
            app_id,
            user_index_canister_id: canister_ids.user_index,
            cycles_dispenser_canister_id: canister_ids.cycles_dispenser,
            deployment_operators: vec![controller],
            authorized_depositors: vec![authorized_depositor],
            wasm_version: wasms::ACTION_INBOX.version,
            test_mode: true,
        },
    );
}
