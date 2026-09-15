use crate::TestEnv;
use crate::client;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::wasms;
use ai_app_verifier_canister::{
    c2c_verify_ai_app,
    c2c_verify_ai_app_v2::{self, ManifestCommitmentV2, VerificationBindingV2},
};
use candid::{CandidType, Principal};
use pocket_ic::PocketIc;
use serde::Serialize;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{
    AiActionCardTemplate, AiActionDefinition, AiActionRule, AiAppManifest, AiAppRegistration, CanisterId, KeywordMapRule,
    KeywordMapping, RuleMode,
};

// A real P-256 SPKI PEM accepted and canonicalized by registry ingress.
const TEST_SPKI_PEM: &str = "-----BEGIN PUBLIC KEY-----\n\
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEL4Rj13upzgERFkEaivsNjEA/HvCr\n\
m+J36bnO257UvRzwEW+OpmmEQt6fZ5lO3So6wXPtuziuv/FXrA6S7sni8g==\n\
-----END PUBLIC KEY-----\n";

const AI_APP_PAGE_SIZE: u8 = 8;

#[derive(CandidType, Serialize)]
struct NeutralVerifierInit {
    name: String,
    owner: Principal,
    vouched: bool,
    expected_v2: Option<VerificationBindingV2>,
}

fn manifest(name: String, description: &str) -> AiAppManifest {
    AiAppManifest {
        name,
        description: description.to_string(),
        icon_url: None,
        app_canister_id: None,
        inbox_canister_id: None,
        consumer_public_key: TEST_SPKI_PEM.to_string(),
        per_user_keys: false,
        actions: vec![],
        surfaces: vec![],
    }
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

// Raw register call so the exact Response variant (incl. InvalidRequest) is observable — the
// happy_path helper panics on anything but Success.
fn register(
    env: &mut PocketIc,
    sender: Principal,
    user_index: CanisterId,
    manifest: AiAppManifest,
) -> user_index_canister::register_ai_app::Response {
    client::execute_msgpack_update(
        env,
        sender,
        user_index,
        "register_ai_app_msgpack",
        &user_index_canister::register_ai_app::Args { manifest },
    )
}

fn owned_ai_apps(env: &PocketIc, sender: Principal, user_index: CanisterId) -> Vec<AiAppRegistration> {
    let mut apps = Vec::new();
    let mut ids = HashSet::new();
    let mut expected_total = None;
    for page_index in 0.. {
        let response: user_index_canister::my_ai_apps::Response = client::execute_msgpack_query(
            env,
            sender,
            user_index,
            "my_ai_apps_msgpack",
            &user_index_canister::my_ai_apps::Args {
                page_index,
                page_size: AI_APP_PAGE_SIZE,
            },
        );
        let user_index_canister::my_ai_apps::Response::Success(result) = response else {
            panic!("owner pagination must succeed: {response:?}")
        };
        assert!(result.apps.len() <= AI_APP_PAGE_SIZE as usize);
        assert_eq!(*expected_total.get_or_insert(result.total), result.total);
        let page_is_empty = result.apps.is_empty();
        for app in result.apps {
            assert!(ids.insert(app.id), "owner pagination must not repeat registrations");
            apps.push(app);
        }
        assert!(apps.len() <= result.total as usize);
        if apps.len() == result.total as usize {
            return apps;
        }
        assert!(
            !page_is_empty,
            "owner pagination must make progress toward its reported total"
        );
    }
    unreachable!()
}

fn apps_by_ids(env: &PocketIc, sender: Principal, user_index: CanisterId, ids: &[types::AiAppId]) -> Vec<AiAppRegistration> {
    let response: user_index_canister::ai_apps_by_ids::Response = client::execute_msgpack_query(
        env,
        sender,
        user_index,
        "ai_apps_by_ids_msgpack",
        &user_index_canister::ai_apps_by_ids::Args {
            lookups: ids
                .iter()
                .map(|&app_id| user_index_canister::ai_apps_by_ids::AiAppLookup { app_id, revision: None })
                .collect(),
        },
    );
    match response {
        user_index_canister::ai_apps_by_ids::Response::Success(result) => {
            assert!(result.apps.len() <= ids.len());
            assert!(result.apps.iter().all(|app| ids.contains(&app.id)));
            result.apps
        }
        other => panic!("exact app lookup must succeed: {other:?}"),
    }
}

// Registering the SAME name (same owner) again upserts the existing entry in place: the id and
// created timestamp survive (per-chat enablement stores the id, so it must be stable), only the
// manifest + `updated` change. Caller-owned read-back must reflect the new description.
#[test]
fn re_register_same_name_upserts_in_place() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();

    let first_id = match register(env, owner.principal, canister_ids.user_index, manifest(name.clone(), "v1")) {
        user_index_canister::register_ai_app::Response::Success(reg) => {
            assert_eq!(reg.manifest.description, "v1");
            reg.id
        }
        other => panic!("expected Success, got {other:?}"),
    };

    // Same name, same owner, changed description -> Success with the SAME id and the new description.
    match register(env, owner.principal, canister_ids.user_index, manifest(name.clone(), "v2")) {
        user_index_canister::register_ai_app::Response::Success(reg) => {
            assert_eq!(reg.id, first_id, "upsert must keep the id stable");
            assert_eq!(reg.manifest.description, "v2");
        }
        other => panic!("expected Success on re-register, got {other:?}"),
    }

    // Caller-owned pagination includes unpublished apps, without other owners' published apps.
    let apps = owned_ai_apps(env, owner.principal, canister_ids.user_index);
    let found = apps
        .iter()
        .find(|a| a.id == first_id)
        .expect("re-registered app must be listed");
    assert_eq!(found.manifest.name, name);
    assert_eq!(found.manifest.description, "v2");
}

// The four local-development accounts remain isolated even when they register the same draft name.
// Test mode must never transfer a stable app id, because enabled chats are keyed by that id.
#[test]
fn same_name_drafts_do_not_transfer_ownership_between_local_accounts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let accounts = [
        client::register_diamond_user(env, canister_ids, *controller), // account A
        client::register_diamond_user(env, canister_ids, *controller), // account B
        client::register_diamond_user(env, canister_ids, *controller), // account C
        client::register_diamond_user(env, canister_ids, *controller), // account D
    ];
    let name = random_string();

    let mut ids = Vec::new();
    for (index, account) in accounts.iter().enumerate() {
        match register(
            env,
            account.principal,
            canister_ids.user_index,
            manifest(name.clone(), &format!("account-{index}")),
        ) {
            user_index_canister::register_ai_app::Response::Success(reg) => {
                assert_eq!(reg.owner, account.user_id);
                assert!(!ids.contains(&reg.id), "an account inherited another owner's app id");
                ids.push(reg.id);
            }
            other => panic!("expected isolated draft registration, got {other:?}"),
        }
    }
}

// An empty consumer_public_key with per_user_keys=false is rejected (the app-level key IS read in
// that mode), and a manifest with more than the 20-action cap is rejected.
#[test]
fn register_rejects_invalid_manifests() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    // Empty key + per_user_keys=false -> InvalidRequest.
    let mut empty_key = manifest(random_string(), "no key");
    empty_key.consumer_public_key = String::new();
    empty_key.per_user_keys = false;
    assert!(
        matches!(
            register(env, owner.principal, canister_ids.user_index, empty_key),
            user_index_canister::register_ai_app::Response::InvalidRequest(_)
        ),
        "empty consumer_public_key with per_user_keys=false must be InvalidRequest"
    );

    for invalid in [
        "-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n",
        "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n",
    ] {
        let mut invalid_key = manifest(random_string(), "invalid key");
        invalid_key.consumer_public_key = invalid.to_string();
        assert!(matches!(
            register(env, owner.principal, canister_ids.user_index, invalid_key),
            user_index_canister::register_ai_app::Response::InvalidRequest(_)
        ));
    }

    // 21 actions (cap is 20) -> InvalidRequest. The length check runs before per-action validation,
    // but each action is still built valid for robustness.
    let action = AiActionDefinition {
        name: "act".to_string(),
        description: "d".to_string(),
        prompt_template: "p".to_string(),
        response_schema: "{}".to_string(),
        card: AiActionCardTemplate {
            title: "t".to_string(),
            confirm_label: "ok".to_string(),
            cancel_label: "no".to_string(),
            rows: vec![types::AiActionCardRowTemplate {
                field: "value".to_string(),
                label: "Value".to_string(),
            }],
            disclosure: None,
        },
        endpoint: "https://example.com/hook".to_string(),
        consumer_public_key: None,
        recipient_scope: None,
        rules: vec![],
        accepts_image: false,
    };
    let mut too_many = manifest(random_string(), "too many actions");
    too_many.actions = vec![action.clone(); 21];
    assert!(
        matches!(
            register(env, owner.principal, canister_ids.user_index, too_many),
            user_index_canister::register_ai_app::Response::InvalidRequest(_)
        ),
        ">20 actions must be InvalidRequest"
    );

    let mut empty_rows = manifest(random_string(), "empty card rows");
    let mut empty_row_action = action.clone();
    empty_row_action.card.rows.clear();
    empty_rows.actions = vec![empty_row_action];
    assert!(matches!(
        register(env, owner.principal, canister_ids.user_index, empty_rows),
        user_index_canister::register_ai_app::Response::InvalidRequest(message)
            if message == "actions[0]: card.rows must contain between 1 and 32 entries"
    ));

    let mut invalid_action = action;
    invalid_action.consumer_public_key = Some("-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n".to_string());
    let mut invalid_action_key = manifest(random_string(), "invalid action key");
    invalid_action_key.actions = vec![invalid_action];
    assert!(matches!(
        register(env, owner.principal, canister_ids.user_index, invalid_action_key),
        user_index_canister::register_ai_app::Response::InvalidRequest(_)
    ));
}

// explore_ai_apps enforces a 2-char minimum search term.
#[test]
fn explore_rejects_short_term_and_accepts_normal() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    for page_size in [0, AI_APP_PAGE_SIZE + 1, 10] {
        let invalid: user_index_canister::explore_ai_apps::Response = client::execute_msgpack_query(
            env,
            owner.principal,
            canister_ids.user_index,
            "explore_ai_apps_msgpack",
            &user_index_canister::explore_ai_apps::Args {
                search_term: Some("test".to_string()),
                page_index: 0,
                page_size,
            },
        );
        assert!(
            matches!(
                invalid,
                user_index_canister::explore_ai_apps::Response::InvalidPageSize(AI_APP_PAGE_SIZE)
            ),
            "out-of-bound page size {page_size} must be rejected: {invalid:?}"
        );
    }

    let short: user_index_canister::explore_ai_apps::Response = client::execute_msgpack_query(
        env,
        owner.principal,
        canister_ids.user_index,
        "explore_ai_apps_msgpack",
        &user_index_canister::explore_ai_apps::Args {
            search_term: Some("a".to_string()),
            page_index: 0,
            page_size: AI_APP_PAGE_SIZE,
        },
    );
    assert!(
        matches!(short, user_index_canister::explore_ai_apps::Response::TermTooShort(2)),
        "1-char term must be TermTooShort(2), got {short:?}"
    );

    let normal: user_index_canister::explore_ai_apps::Response = client::execute_msgpack_query(
        env,
        owner.principal,
        canister_ids.user_index,
        "explore_ai_apps_msgpack",
        &user_index_canister::explore_ai_apps::Args {
            search_term: Some("test".to_string()),
            page_index: 0,
            page_size: AI_APP_PAGE_SIZE,
        },
    );
    assert!(
        matches!(normal, user_index_canister::explore_ai_apps::Response::Success(_)),
        "a normal-length term must be Success, got {normal:?}"
    );
}

// delete_ai_app removes the caller's app by name; a second delete of the same name is NotFound.
#[test]
fn delete_then_not_found() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();
    let _ = register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest(name.clone(), "to delete"),
    );
    tick_many(env, 1);

    let first: user_index_canister::delete_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "delete_ai_app_msgpack",
        &user_index_canister::delete_ai_app::Args { name: name.clone() },
    );
    assert!(
        matches!(first, user_index_canister::delete_ai_app::Response::Success),
        "first delete must Succeed, got {first:?}"
    );

    let second: user_index_canister::delete_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "delete_ai_app_msgpack",
        &user_index_canister::delete_ai_app::Args { name },
    );
    assert!(
        matches!(second, user_index_canister::delete_ai_app::Response::NotFound),
        "second delete must be NotFound, got {second:?}"
    );
}

#[test]
fn registration_rejects_unicode_confusables_and_caps_unpublished_drafts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let confusable = register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest("Αcme".to_string(), "Greek alpha is not ASCII A"),
    );
    assert!(
        matches!(confusable, user_index_canister::register_ai_app::Response::InvalidRequest(_)),
        "Unicode-confusable names must fail at the public endpoint: {confusable:?}"
    );

    for index in 0..5 {
        let response = register(
            env,
            owner.principal,
            canister_ids.user_index,
            manifest(format!("draft-{index}"), "bounded draft"),
        );
        assert!(matches!(response, user_index_canister::register_ai_app::Response::Success(_)));
    }
    let overflow = register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest("draft-overflow".to_string(), "must be rejected"),
    );
    assert!(
        matches!(overflow, user_index_canister::register_ai_app::Response::InvalidRequest(_)),
        "a sixth unpublished draft must be rejected: {overflow:?}"
    );
}

#[test]
fn expired_drafts_are_reclaimed_through_the_public_registration_path() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    for index in 0..5 {
        let response = register(
            env,
            owner.principal,
            canister_ids.user_index,
            manifest(format!("expiring-{index}"), "short-lived draft"),
        );
        assert!(matches!(response, user_index_canister::register_ai_app::Response::Success(_)));
    }

    env.advance_time(Duration::from_millis(30 * constants::DAY_IN_MS + 1));
    let replacement = register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest("after-expiry".to_string(), "reclaimed slot"),
    );
    let replacement_id = match replacement {
        user_index_canister::register_ai_app::Response::Success(registration) => registration.id,
        other => panic!("expired drafts must release owner/global capacity: {other:?}"),
    };
    let visible = owned_ai_apps(env, owner.principal, canister_ids.user_index);
    assert_eq!(visible.len(), 1, "lazy expiry must physically reclaim all five drafts");
    assert_eq!(visible[0].id, replacement_id);
    // Do not return a clock advanced by thirty days to the shared environment pool.
    wrapper.discard();
}

#[test]
fn governance_can_recover_an_app_after_owner_loss() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app_id = match register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest("abandoned-app".to_string(), "owner unavailable"),
    ) {
        user_index_canister::register_ai_app::Response::Success(registration) => registration.id,
        other => panic!("registration failed: {other:?}"),
    };

    let unauthorised = env.update_call(
        canister_ids.user_index,
        owner.principal,
        "remove_ai_app",
        candid::encode_one(&user_index_canister::remove_ai_app::Args { app_id }).unwrap(),
    );
    assert!(
        unauthorised.is_err(),
        "an app owner cannot invoke the governance recovery path"
    );

    let response = client::user_index::remove_ai_app(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::remove_ai_app::Args { app_id },
    );
    assert!(matches!(response, user_index_canister::remove_ai_app::Response::Success));
    assert!(owned_ai_apps(env, owner.principal, canister_ids.user_index).is_empty());

    let second = client::user_index::remove_ai_app(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::remove_ai_app::Args { app_id },
    );
    assert!(matches!(second, user_index_canister::remove_ai_app::Response::NotFound));
}

fn keyword_map_action() -> AiActionDefinition {
    AiActionDefinition {
        name: "expense.import".to_string(),
        description: "d".to_string(),
        prompt_template: "p".to_string(),
        response_schema: "{}".to_string(),
        card: AiActionCardTemplate {
            title: "t".to_string(),
            confirm_label: "ok".to_string(),
            cancel_label: "no".to_string(),
            rows: vec![types::AiActionCardRowTemplate {
                field: "value".to_string(),
                label: "Value".to_string(),
            }],
            disclosure: None,
        },
        endpoint: "https://example.com/hook".to_string(),
        consumer_public_key: None,
        recipient_scope: None,
        rules: vec![AiActionRule::KeywordMap(KeywordMapRule {
            field: "template".to_string(),
            mode: RuleMode::Override,
            map: vec![KeywordMapping {
                value: "groceries".to_string(),
                keywords: vec!["supermarket".to_string(), "grocery".to_string()],
            }],
        })],
        accepts_image: false,
    }
}

// Re-registering a name with the BASE manifest (actions = []) wholesale-replaces the stored
// manifest, dropping previously registered keyword_map rules. This pins the destructive
// overwrite so the frontend's re-sync-after-redeploy obligation is explicit.
#[test]
fn re_register_with_base_manifest_drops_keyword_map_rules() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();

    // v1: one action carrying a keyword_map rule (a generic saved-type fold).
    let mut with_rules = manifest(name.clone(), "with rules");
    with_rules.actions = vec![keyword_map_action()];
    let id = match register(env, owner.principal, canister_ids.user_index, with_rules) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };
    let apps = owned_ai_apps(env, owner.principal, canister_ids.user_index);
    let app = apps.iter().find(|a| a.id == id).expect("registered app must be listed");
    assert_eq!(app.manifest.actions.len(), 1, "rules must be present before the re-register");

    // v2: fresh-deploy re-registration of the SAME name with the BASE manifest (no actions).
    match register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest(name.clone(), "base redeploy"),
    ) {
        user_index_canister::register_ai_app::Response::Success(reg) => {
            assert_eq!(reg.id, id, "upsert keeps the id");
        }
        other => panic!("expected Success, got {other:?}"),
    }

    let apps = owned_ai_apps(env, owner.principal, canister_ids.user_index);
    let app = apps.iter().find(|a| a.id == id).expect("app still listed");
    assert!(
        app.manifest.actions.is_empty(),
        "register() replaces the manifest wholesale: keyword_map rules are GONE until the app re-syncs, got {:?}",
        app.manifest.actions
    );
}

// A manifest whose action carries an AiActionRule::KeywordMap registers within caps and the rule
// payload round-trips UNMANGLED through register + owned read-back (per-variant serde renames on
// the wire). Directly covers a consumer app's saved-types -> manifest fold.
#[test]
fn keyword_map_rules_survive_register_and_read_back() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();

    let mut with_rules = manifest(name.clone(), "keyword-map app");
    with_rules.actions = vec![keyword_map_action()];
    let id = match register(env, owner.principal, canister_ids.user_index, with_rules) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };

    let apps = owned_ai_apps(env, owner.principal, canister_ids.user_index);
    let app = apps.iter().find(|a| a.id == id).expect("app must be listed");
    assert_eq!(app.manifest.actions.len(), 1);
    let action = &app.manifest.actions[0];
    assert_eq!(action.name, "expense.import");
    assert_eq!(action.rules.len(), 1);
    let AiActionRule::KeywordMap(rule) = &action.rules[0] else {
        panic!("expected KeywordMap rule, got {:?}", action.rules[0]);
    };
    assert_eq!(rule.field, "template");
    assert!(matches!(rule.mode, RuleMode::Override));
    assert_eq!(rule.map.len(), 1);
    assert_eq!(rule.map[0].value, "groceries");
    assert_eq!(rule.map[0].keywords, vec!["supermarket".to_string(), "grocery".to_string()]);
}

// publish_ai_app for a manifest with NO app_canister_id -> NotVerified (the anti-squat gate
// requires a canister that can vouch; it fails closed), and the app stays out of the explorer.
#[test]
fn publish_without_app_canister_is_not_verified() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();

    // manifest() sets app_canister_id: None.
    let id = match register(
        env,
        owner.principal,
        canister_ids.user_index,
        manifest(name.clone(), "unverifiable"),
    ) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };

    let publish: user_index_canister::publish_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "publish_ai_app_msgpack",
        &user_index_canister::publish_ai_app::Args { app_id: id },
    );
    assert!(
        matches!(publish, user_index_canister::publish_ai_app::Response::NotVerified),
        "absent app_canister_id must be NotVerified, got {publish:?}"
    );

    // Still unpublished: absent from the public explorer (search covers PUBLISHED apps only).
    let explore: user_index_canister::explore_ai_apps::Response = client::execute_msgpack_query(
        env,
        owner.principal,
        canister_ids.user_index,
        "explore_ai_apps_msgpack",
        &user_index_canister::explore_ai_apps::Args {
            search_term: Some(name.clone()),
            page_index: 0,
            page_size: AI_APP_PAGE_SIZE,
        },
    );
    if let user_index_canister::explore_ai_apps::Response::Success(result) = explore {
        assert!(
            !result.matches.iter().any(|a| a.id == id),
            "an unpublished app must not appear in explore"
        );
    } else {
        panic!("valid bounded explorer query must succeed: {explore:?}");
    }
}

// SECURITY (fail closed): every non-vouch outcome maps to NotVerified and the app never becomes
// published. Covers the reject paths reachable without a stub: an empty canister (no wasm) and a
// live canister that does not implement c2c_verify_ai_app.
#[test]
fn publish_fails_closed_when_verifier_cannot_vouch() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let user_index = canister_ids.user_index;

    let owner = client::register_diamond_user(env, canister_ids, *controller);

    fn publish(
        env: &mut PocketIc,
        sender: Principal,
        user_index: CanisterId,
        app_id: types::AiAppId,
    ) -> user_index_canister::publish_ai_app::Response {
        client::execute_msgpack_update(
            env,
            sender,
            user_index,
            "publish_ai_app_msgpack",
            &user_index_canister::publish_ai_app::Args { app_id },
        )
    }

    // Variant 1: app_canister_id points at an EMPTY canister (created, no wasm) -> c2c rejects.
    let empty_canister = client::create_canister(env, *controller);
    let mut m1 = manifest(random_string(), "empty verifier");
    m1.app_canister_id = Some(empty_canister);
    let id1 = match register(env, owner.principal, user_index, m1) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };
    let r1 = publish(env, owner.principal, user_index, id1);
    assert!(
        matches!(r1, user_index_canister::publish_ai_app::Response::NotVerified),
        "empty verifier canister must be NotVerified, got {r1:?}"
    );

    // Variant 2: a LIVE canister that does not implement c2c_verify_ai_app (method not found).
    let mut m2 = manifest(random_string(), "non-verifier canister");
    m2.app_canister_id = Some(user_index);
    let id2 = match register(env, owner.principal, user_index, m2) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };
    let r2 = publish(env, owner.principal, user_index, id2);
    assert!(
        matches!(r2, user_index_canister::publish_ai_app::Response::NotVerified),
        "a canister without c2c_verify_ai_app must be NotVerified, got {r2:?}"
    );

    // Neither app ever became published: both absent from the public explorer for a non-owner.
    let other_user = client::register_diamond_user(env, canister_ids, *controller);
    let apps = apps_by_ids(env, other_user.principal, user_index, &[id1, id2]);
    assert!(
        !apps.iter().any(|a| a.id == id1 || a.id == id2),
        "failed publishes must leave the apps invisible to non-owners"
    );
}

// MIGRATION (fail closed): a canister that positively implements only the legacy, name/owner V1
// contract is still not trusted for publication. Existing apps must configure V2 and republish.
#[test]
fn publish_rejects_a_legacy_v1_only_vouch() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let user_index = canister_ids.user_index;
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let verifier_canister = client::create_canister(env, *controller);
    let name = "legacy-v1-app".to_string();

    client::install_canister(
        env,
        *controller,
        verifier_canister,
        wasms::AI_APP_VERIFIER_TEST.clone(),
        NeutralVerifierInit {
            name: name.clone(),
            owner: owner.user_id.as_principal(),
            vouched: true,
            expected_v2: None,
        },
    );

    let legacy: c2c_verify_ai_app::Response = client::execute_update(
        env,
        owner.principal,
        verifier_canister,
        "c2c_verify_ai_app",
        &c2c_verify_ai_app::Args {
            name: name.clone(),
            owner: owner.user_id.as_principal(),
        },
    );
    assert!(legacy.vouched, "fixture must genuinely vouch over V1");

    let mut draft_manifest = manifest(name, "legacy verifier");
    draft_manifest.app_canister_id = Some(verifier_canister);
    let draft = match register(env, owner.principal, user_index, draft_manifest) {
        user_index_canister::register_ai_app::Response::Success(registration) => registration,
        other => panic!("expected registration Success, got {other:?}"),
    };
    let publish: user_index_canister::publish_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        user_index,
        "publish_ai_app_msgpack",
        &user_index_canister::publish_ai_app::Args { app_id: draft.id },
    );
    assert!(
        matches!(publish, user_index_canister::publish_ai_app::Response::NotVerified),
        "V1 must never satisfy the V2 publication gate: {publish:?}"
    );
}

// Upsert preserves the id, but delete + re-register does NOT: the fresh registration mints a
// NEW id, so any per-chat enablement that stored the old id is left dangling. Documents the
// id-stability difference between the two "redeploy" flows (a deploy script that
// deletes-then-registers silently breaks enablement; the in-place upsert does not).
#[test]
fn delete_then_re_register_mints_a_new_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let name = random_string();

    let id1 = match register(env, owner.principal, canister_ids.user_index, manifest(name.clone(), "v1")) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg.id,
        other => panic!("expected Success, got {other:?}"),
    };

    let deleted: user_index_canister::delete_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "delete_ai_app_msgpack",
        &user_index_canister::delete_ai_app::Args { name: name.clone() },
    );
    assert!(matches!(deleted, user_index_canister::delete_ai_app::Response::Success));

    match register(env, owner.principal, canister_ids.user_index, manifest(name, "v2")) {
        user_index_canister::register_ai_app::Response::Success(reg) => {
            assert_ne!(
                reg.id, id1,
                "delete + re-register mints a FRESH id (unlike the in-place upsert)"
            );
        }
        other => panic!("expected Success on re-register, got {other:?}"),
    }
}

// HAPPY path of the anti-squat gate with a REAL verifier: publish succeeds when the canister the
// manifest points at vouches over the generic `c2c_verify_ai_app_v2` contract. The verifier here is
// a neutral verifier fixture canister configured with the exact registry row and manifest hash, so
// this exercises the full candid c2c round-trip rather than an application fixture.
// becomes visible to non-owners and in the public explorer.
#[test]
fn publish_succeeds_when_app_canister_vouches() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let user_index = canister_ids.user_index;

    // Reserve the canister id first, then register the manifest that points to it. V2 intentionally
    // binds the resulting immutable app id and revision, so the verifier is configured afterwards.
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let verifier_canister = client::create_canister(env, *controller);
    let mut m = manifest("sample-app".to_string(), "neutral verifier fixture");
    m.app_canister_id = Some(verifier_canister);
    m.per_user_keys = true;
    let draft = match register(env, owner.principal, user_index, m) {
        user_index_canister::register_ai_app::Response::Success(reg) => reg,
        other => panic!("expected Success, got {other:?}"),
    };
    let id = draft.id;
    client::install_canister(
        env,
        *controller,
        verifier_canister,
        wasms::AI_APP_VERIFIER_TEST.clone(),
        NeutralVerifierInit {
            name: draft.manifest.name.clone(),
            owner: owner.user_id.as_principal(),
            vouched: true,
            expected_v2: Some(verification_binding(user_index, &draft)),
        },
    );

    let publish: user_index_canister::publish_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        user_index,
        "publish_ai_app_msgpack",
        &user_index_canister::publish_ai_app::Args { app_id: id },
    );
    assert!(
        matches!(publish, user_index_canister::publish_ai_app::Response::Success),
        "a vouching app canister must publish with Success, got {publish:?}"
    );

    // Read back the same two ways the negative tests use.
    // 1. A NON-owner now sees the exact app, even beyond the legacy first page, flagged published.
    let other_user = client::register_diamond_user(env, canister_ids, *controller);
    let apps = apps_by_ids(env, other_user.principal, user_index, &[id]);
    let app = apps
        .iter()
        .find(|a| a.id == id)
        .expect("a published app must be visible to non-owners");
    assert!(app.published, "read-back must carry published = true");

    // 2. It appears in the public explorer (search covers PUBLISHED apps only).
    let explore: user_index_canister::explore_ai_apps::Response = client::execute_msgpack_query(
        env,
        other_user.principal,
        user_index,
        "explore_ai_apps_msgpack",
        &user_index_canister::explore_ai_apps::Args {
            search_term: Some("sample-app".to_string()),
            page_index: 0,
            page_size: AI_APP_PAGE_SIZE,
        },
    );
    match explore {
        user_index_canister::explore_ai_apps::Response::Success(result) => {
            assert!(
                result.matches.iter().any(|a| a.id == id),
                "the published app must appear in explore"
            );
        }
        other => panic!("explore must Succeed, got {other:?}"),
    }
}
