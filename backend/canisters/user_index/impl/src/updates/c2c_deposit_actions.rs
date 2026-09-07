use crate::guards::caller_is_local_user_index_canister;
use crate::model::action_delivery_outbox::{
    ActionDeliveryAttemptId, ActionDeliveryCompletion, ActionDeliveryDispatch, ActionDeliveryStart,
};
use crate::model::ai_app_registry::AiAppRegistry;
use crate::model::ai_app_user_keys::AiAppUserKeys;
use crate::updates::create_ai_app_card_provenance::validate_direct_card_lui_route;
use crate::{mutate_state, read_state};
use action_inbox_canister::c2c_notify_actions;
use canister_api_macros::update;
use group_index_canister::ai_app_card_authority::{AiAppCardAuthorityBindingV1, AiAppCardAuthorityOperationV1};
use jwt::sign_bytes;
use serde::Serialize;
use serde_bytes::ByteBuf;
use std::collections::{BTreeMap, BTreeSet};
use types::{AiAppId, CanisterId, TimestampMillis, UserId};
use user_index_canister::c2c_deposit_actions::{Response::*, *};
use zeroize::Zeroizing;

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
async fn c2c_deposit_actions(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    let admitted_at = match mutate_state(|state| {
        let now = state.env.now();
        state
            .data
            .ai_app_call_throttle
            .admit_action_deposit(caller, args.app_id, now)
            .map(|()| now)
    }) {
        Ok(now) => now,
        Err(retry_after_ms) => {
            return Error(format!("action deposit relay throttled; retry after {retry_after_ms}ms"));
        }
    };
    if let Err(error) = validate_deposit_commitments(&args) {
        finish_action_deposit_admission(caller, args.app_id, admitted_at);
        return Error(error);
    }
    let authority_binding = match authoritative_binding(&args, caller) {
        Ok(binding) => binding,
        Err(error) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error);
        }
    };
    if matches!(args.authority_context.chat, types::Chat::Direct(_))
        && let Err(error) =
            read_state(|state| validate_direct_card_lui_route(&args.authority_context, &args.authority, caller, state))
    {
        finish_action_deposit_admission(caller, args.app_id, admitted_at);
        return Error(error);
    }
    if let Err(error) = validate_encoded_deposit_payload(&args) {
        finish_action_deposit_admission(caller, args.app_id, admitted_at);
        return Error(error);
    }
    let delivery_identity = match action_delivery_identity(&authority_binding) {
        Ok(identity) => identity,
        Err(error) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error);
        }
    };
    let slot_id = delivery_identity.slot_id;
    let attempt_id = delivery_identity.attempt_id;
    let attempt_created_at = delivery_identity.attempt_created_at;
    let reserved_bytes = match estimated_signed_request_size(&args) {
        Ok(bytes) => bytes,
        Err(error) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error);
        }
    };
    let outbox_start = mutate_state(|state| {
        let now = state.env.now();
        state.data.action_delivery_outbox.start_in_slot(
            slot_id,
            attempt_id,
            args.app_id,
            reserved_bytes,
            attempt_created_at,
            now,
        )
    });
    let preparation_epoch = match outbox_start {
        Ok(ActionDeliveryStart::Prepare { epoch }) => epoch,
        Ok(ActionDeliveryStart::Dispatch) => {
            let dispatch = match read_state(|state| state.data.action_delivery_outbox.dispatch(attempt_id)) {
                Ok(dispatch) => dispatch,
                Err(error) => {
                    finish_action_deposit_admission(caller, args.app_id, admitted_at);
                    return Error(error.message().to_string());
                }
            };
            read_state(crate::jobs::action_delivery_outbox::start_job_if_required);
            let completion = deliver_and_complete(dispatch).await;
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return response_from_delivery_completion(completion);
        }
        Ok(ActionDeliveryStart::Pending) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return OutcomeUnknown;
        }
        Ok(ActionDeliveryStart::Delivered) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Success;
        }
        Ok(ActionDeliveryStart::Rejected) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error("action deposit rejected".to_string());
        }
        Err(error) => {
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error.message().to_string());
        }
    };
    // This is the authority boundary: never accept a LocalUserIndex-selected destination. Resolve
    // the exact current published revision in the registry immediately before dispatch. IC update
    // execution is serialized until this outbound call is issued, so a concurrent re-registration
    // cannot redirect a relay that was authorized for a different revision.
    let inbox_canister_id = match read_state(|state| {
        resolve_current_route(
            &state.data.ai_apps,
            &state.data.ai_app_user_keys,
            &state.data.ai_app_scoped_identity_key,
            state.env.canister_id(),
            &args,
        )
    }) {
        Ok(canister_id) => canister_id,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error);
        }
    };
    // Keep this readiness hook before the authority await. #51 can extend it with entropy readiness
    // without ever validating an authority that this UserIndex cannot turn into an exact request.
    if let Err(error) = mutate_state(pre_authority_validation_readiness) {
        abort_action_delivery_preparation(attempt_id, preparation_epoch);
        finish_action_deposit_admission(caller, args.app_id, admitted_at);
        return Error(error);
    }
    // Group/channel cards validate the exact GroupIndex assertion without destructively consuming
    // its bearer. Direct cards already proved the exact current home LUI and carry no GroupIndex
    // token. The durable full-attempt outbox is the semantic one-use barrier: equivalent retries
    // observe one stored attempt, while a changed binding produces a different identity or fails
    // route validation. A lost validation callback has no remote side effect and is safely retryable.
    if !matches!(args.authority_context.chat, types::Chat::Direct(_)) {
        match crate::ai_app_card_authority::validate(authority_binding.clone(), &args.authority).await {
            Ok(validated) if validated == authority_binding => {}
            _ => {
                abort_action_delivery_preparation(attempt_id, preparation_epoch);
                finish_action_deposit_admission(caller, args.app_id, admitted_at);
                return Error("action deposit authority is invalid or stale".to_string());
            }
        }
    }
    // App-authorized fan-out is re-authorized immediately before preparation. The LUI-carried
    // grant is opaque here: rebuild the exact request from authoritative card state, call the
    // currently vouched app canister, then compare its result to both the grant and current keys.
    // Default/confirmer-only actions take no app callback path.
    let recipient_callback = match read_state(|state| {
        let authorization_created_at = args
            .recipient_authorization
            .as_ref()
            .map(|grant| grant.authorization_created_at)
            .unwrap_or_default();
        crate::updates::c2c_ai_app_confirmed_action_route::recipient_authorization_callback(
            &authority_binding,
            &state.data.ai_apps,
            &state.data.ai_app_scoped_identity_key,
            state.env.canister_id(),
            authorization_created_at,
        )
    }) {
        Ok(callback) => callback,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error(error);
        }
    };
    let callback_result = match (&args.recipient_authorization, recipient_callback) {
        (None, None) => None,
        (Some(expected_grant), Some((app_canister_id, callback_args)))
            if callback_args.authorization_created_at == expected_grant.authorization_created_at =>
        {
            match ai_app_verifier_canister_c2c_client::c2c_authorize_ai_action_recipients(app_canister_id, &callback_args).await
            {
                Ok(ai_app_verifier_canister::c2c_authorize_ai_action_recipients::Response::Success(result)) => Some(result),
                _ => {
                    abort_action_delivery_preparation(attempt_id, preparation_epoch);
                    finish_action_deposit_admission(caller, args.app_id, admitted_at);
                    return Error("app recipient authorization is unavailable or stale".to_string());
                }
            }
        }
        _ => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, args.app_id, admitted_at);
            return Error("action recipient authorization does not match its manifest scope".to_string());
        }
    };
    // Recheck the authoritative shard, app/account keys and exact route after the validation await and
    // immediately before signing.
    if !read_state(|state| {
        let direct_route_is_current = !matches!(args.authority_context.chat, types::Chat::Direct(_))
            || validate_direct_card_lui_route(&args.authority_context, &args.authority, caller, state).is_ok();
        let callback_is_current = match (&args.recipient_authorization, &callback_result) {
            (None, None) => true,
            (Some(grant), Some(result)) => validate_app_authorized_callback_result(
                &state.data.ai_apps,
                &state.data.ai_app_user_keys,
                &state.data.ai_app_scoped_identity_key,
                state.env.canister_id(),
                args.app_id,
                args.app_revision,
                &args.action_id,
                args.confirmed_by,
                result,
                grant,
                &args.recipient_key_bindings,
                state.env.now(),
            )
            .is_ok(),
            _ => false,
        };
        direct_route_is_current
            && callback_is_current
            && resolve_current_route(
                &state.data.ai_apps,
                &state.data.ai_app_user_keys,
                &state.data.ai_app_scoped_identity_key,
                state.env.canister_id(),
                &args,
            ) == Ok(inbox_canister_id)
    }) {
        abort_action_delivery_preparation(attempt_id, preparation_epoch);
        finish_action_deposit_admission(caller, args.app_id, admitted_at);
        return Error("action deposit relay is unavailable".to_string());
    }
    let app_id = args.app_id;
    let app_revision = args.app_revision;
    let action_id = args.action_id.clone();
    let recipient_key_bindings = args.recipient_key_bindings.clone();
    let card_context_hash = match read_state(|state| {
        card_context_hash(
            &authority_binding,
            &state.data.ai_apps,
            &state.data.ai_app_scoped_identity_key,
            state.env.canister_id(),
        )
    }) {
        Ok(hash) => hash,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, app_id, admitted_at);
            return Error(error);
        }
    };
    let deposits = match crate::mutate_state(|state| {
        sign_authoritative_deposits(
            args.deposits,
            inbox_canister_id,
            app_id,
            app_revision,
            &action_id,
            &card_context_hash,
            state,
        )
    }) {
        Ok(deposits) => deposits,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, app_id, admitted_at);
            return Error(error);
        }
    };
    let inbox_args = c2c_notify_actions::Args { app_id, deposits };
    let exact_request = match serialize_action_inbox_request(&inbox_args) {
        Ok(request) => request,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, app_id, admitted_at);
            return Error(error);
        }
    };
    let dispatch = match mutate_state(|state| {
        let now = state.env.now();
        let dispatch = state.data.action_delivery_outbox.store_prepared(
            attempt_id,
            preparation_epoch,
            inbox_canister_id,
            exact_request,
            now,
        );
        if dispatch.is_ok() {
            crate::jobs::action_delivery_outbox::start_job_if_required(state);
        }
        dispatch
    }) {
        Ok(dispatch) => dispatch,
        Err(error) => {
            abort_action_delivery_preparation(attempt_id, preparation_epoch);
            finish_action_deposit_admission(caller, app_id, admitted_at);
            return Error(error.message().to_string());
        }
    };
    let completion = deliver_and_complete(dispatch).await;
    finish_action_deposit_admission(caller, app_id, admitted_at);
    // Observe revocation/re-registration after the await. A definite Success remains Success because
    // the side effect already happened; failures remain ambiguity-safe and reveal no remote details.
    let _route_still_current = read_state(|state| {
        let direct_route_is_current = !matches!(args.authority_context.chat, types::Chat::Direct(_))
            || validate_direct_card_lui_route(&args.authority_context, &args.authority, caller, state).is_ok();
        direct_route_is_current
            && resolve_current_route_bindings(
                &state.data.ai_apps,
                &state.data.ai_app_user_keys,
                &state.data.ai_app_scoped_identity_key,
                state.env.canister_id(),
                app_id,
                app_revision,
                &action_id,
                args.confirmed_by,
                &recipient_key_bindings,
                args.recipient_authorization.as_ref(),
            ) == Ok(inbox_canister_id)
    });
    response_from_delivery_completion(completion)
}

async fn deliver_and_complete(dispatch: ActionDeliveryDispatch) -> ActionDeliveryCompletion {
    let remote_result = crate::jobs::action_delivery_outbox::deliver_exact(&dispatch).await;
    mutate_state(|state| {
        let now = state.env.now();
        let completion = state
            .data
            .action_delivery_outbox
            .complete(dispatch.attempt_id, dispatch.epoch, remote_result, now)
            .unwrap_or(ActionDeliveryCompletion::OutcomeUnknown);
        crate::jobs::action_delivery_outbox::start_job_if_required(state);
        completion
    })
}

fn response_from_delivery_completion(completion: ActionDeliveryCompletion) -> Response {
    match completion {
        ActionDeliveryCompletion::Delivered => Success,
        ActionDeliveryCompletion::Rejected => Error("action deposit rejected".to_string()),
        ActionDeliveryCompletion::OutcomeUnknown => OutcomeUnknown,
    }
}

fn abort_action_delivery_preparation(attempt_id: ActionDeliveryAttemptId, epoch: u64) {
    mutate_state(|state| state.data.action_delivery_outbox.abort_preparation(attempt_id, epoch));
}

fn sign_authoritative_deposits(
    deposits: Vec<UnsignedActionDeposit>,
    inbox_canister_id: CanisterId,
    app_id: AiAppId,
    app_revision: TimestampMillis,
    action_id: &str,
    card_context_hash: &[u8; ecies_payload::ACTION_CARD_CONTEXT_HASH_BYTES],
    state: &mut crate::RuntimeState,
) -> Result<Vec<c2c_notify_actions::ActionDeposit>, String> {
    let mut signing_rng =
        crate::pr2_entropy::output_rng(state, b"user-index/action-deposit-signatures/v4").map_err(str::to_string)?;
    let (key_id, secret_key_der) = state
        .data
        .action_signing_keyring
        .active_key()
        .map(|(key_id, secret_key_der)| (*key_id, Zeroizing::new(secret_key_der.to_vec())))
        .ok_or_else(|| "action-signing keyring is not initialized".to_string())?;
    let user_index_canister_id = state.env.canister_id();
    deposits
        .into_iter()
        .map(|deposit| {
            let preimage = ecies_payload::action_signature_preimage_v4(&ecies_payload::ActionSignatureContext {
                key_id: &key_id,
                user_index_canister_id,
                inbox_canister_id,
                app_id,
                app_revision,
                action_id,
                card_context_hash,
                consumer_key_fingerprint: deposit.consumer_key_fingerprint.as_ref(),
                idempotency_key: deposit.idempotency_key.as_ref(),
                payload_hash: deposit.payload_hash.as_ref(),
                acknowledgement_secret_hash: deposit.acknowledgement_secret_hash.as_ref(),
                ephemeral_public_key: deposit.ephemeral_public_key.as_ref(),
                ciphertext: deposit.ciphertext.as_ref(),
                created_at: deposit.created_at,
            })?;
            let signature = sign_bytes(&preimage, &secret_key_der, &mut signing_rng)
                .map_err(|error| format!("failed to sign action deposit: {error:?}"))?;
            Ok(c2c_notify_actions::ActionDeposit {
                idempotency_key: deposit.idempotency_key,
                payload_hash: deposit.payload_hash,
                card_context_hash: ByteBuf::from(card_context_hash.to_vec()),
                app_revision,
                action_id: action_id.to_string(),
                consumer_key_fingerprint: deposit.consumer_key_fingerprint,
                acknowledgement_secret_hash: deposit.acknowledgement_secret_hash,
                ephemeral_public_key: deposit.ephemeral_public_key,
                ciphertext: deposit.ciphertext,
                signature_version: ecies_payload::ACTION_INBOX_SIGNATURE_VERSION_V4,
                signing_key_id: ByteBuf::from(key_id.to_vec()),
                oc_signature: ByteBuf::from(signature),
                created_at: deposit.created_at,
            })
        })
        .collect()
}

/// Domain-separated identity for one authoritative confirmation attempt. Only this digest is used
/// as the outbox key; raw internal chat/user coordinates never enter metrics or logs.
fn action_delivery_attempt_identity(
    binding: &AiAppCardAuthorityBindingV1,
) -> Result<(ActionDeliveryAttemptId, TimestampMillis), String> {
    const DOMAIN: &[u8] = b"openchat/action-inbox/delivery-attempt/v1\0";
    let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
        confirm_payload_hash,
        confirmation_lease_generation,
        created_at,
    } = &binding.operation
    else {
        return Err("action authority has the wrong operation".to_string());
    };
    let context = &binding.context;
    let mut canonical = Vec::with_capacity(DOMAIN.len() + 256 + context.action_id.len());
    canonical.extend_from_slice(DOMAIN);
    append_principal(&mut canonical, binding.local_user_index_canister_id)?;
    match context.chat {
        types::Chat::Direct(chat_id) => {
            canonical.push(0);
            append_principal(&mut canonical, chat_id.into())?;
        }
        types::Chat::Group(chat_id) => {
            canonical.push(1);
            append_principal(&mut canonical, chat_id.into())?;
        }
        types::Chat::Channel(community_id, channel_id) => {
            canonical.push(2);
            append_principal(&mut canonical, community_id.into())?;
            canonical.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        }
    }
    match context.thread_root_message_index {
        None => canonical.push(0),
        Some(index) => {
            canonical.push(1);
            canonical.extend_from_slice(&u32::from(index).to_be_bytes());
        }
    }
    canonical.extend_from_slice(&context.message_id.as_u64().to_be_bytes());
    append_principal(&mut canonical, context.user_id.as_principal())?;
    canonical.extend_from_slice(&context.app_id.to_be_bytes());
    canonical.extend_from_slice(&context.app_revision.to_be_bytes());
    let action_len = u32::try_from(context.action_id.len()).map_err(|_| "action id is too long".to_string())?;
    canonical.extend_from_slice(&action_len.to_be_bytes());
    canonical.extend_from_slice(context.action_id.as_bytes());
    canonical.extend_from_slice(&binding.content_hash);
    canonical.extend_from_slice(&confirmation_lease_generation.to_be_bytes());
    canonical.extend_from_slice(confirm_payload_hash);
    canonical.extend_from_slice(&created_at.to_be_bytes());
    Ok((sha256::sha256(&canonical), *created_at))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ActionDeliveryIdentity {
    slot_id: crate::model::action_delivery_outbox::ActionDeliverySlotId,
    attempt_id: ActionDeliveryAttemptId,
    attempt_created_at: TimestampMillis,
}

fn action_delivery_identity(binding: &AiAppCardAuthorityBindingV1) -> Result<ActionDeliveryIdentity, String> {
    if matches!(binding.context.chat, types::Chat::Direct(_)) {
        direct_action_delivery_identity(binding)
    } else {
        let (attempt_id, attempt_created_at) = action_delivery_attempt_identity(binding)?;
        Ok(ActionDeliveryIdentity {
            slot_id: attempt_id,
            attempt_id,
            attempt_created_at,
        })
    }
}

fn direct_action_delivery_identity(binding: &AiAppCardAuthorityBindingV1) -> Result<ActionDeliveryIdentity, String> {
    const SLOT_DOMAIN: &[u8] = b"openchat/action-inbox/direct-delivery-slot/v1\0";
    const ATTEMPT_DOMAIN: &[u8] = b"openchat/action-inbox/direct-delivery-attempt/v1\0";
    let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
        confirm_payload_hash,
        confirmation_lease_generation,
        created_at,
    } = &binding.operation
    else {
        return Err("action authority has the wrong operation".to_string());
    };
    if !matches!(binding.context.chat, types::Chat::Direct(_)) {
        return Err("direct delivery identity requires a direct chat".to_string());
    }

    // `authoritative_binding` has already proved that this key is the canonical sorted direct pair
    // plus thread/message coordinates. Both mirrored User canisters therefore derive the same slot
    // even though their confirmer, home LUI, recipient key, and encrypted deposit differ.
    let card_identity = card_identity_digest(
        &binding.context.chat_key,
        binding.context.thread_root_message_index.map(u32::from),
        binding.context.message_id.as_u64(),
    );
    let mut slot = Vec::with_capacity(SLOT_DOMAIN.len() + 4 + card_identity.len());
    slot.extend_from_slice(SLOT_DOMAIN);
    slot.extend_from_slice(&binding.context.app_id.to_be_bytes());
    slot.extend_from_slice(&card_identity);
    let slot_id = sha256::sha256(&slot);

    // The exact attempt excludes the current LUI route so a home-shard move can reconcile the same
    // confirmer's immutable lease. It still commits the confirmer and every value that can change
    // the authorized external action.
    let mut attempt = Vec::with_capacity(ATTEMPT_DOMAIN.len() + 256 + binding.context.action_id.len());
    attempt.extend_from_slice(ATTEMPT_DOMAIN);
    attempt.extend_from_slice(&slot_id);
    append_principal(&mut attempt, binding.context.user_id.as_principal())?;
    attempt.extend_from_slice(&binding.context.app_revision.to_be_bytes());
    let action_len = u32::try_from(binding.context.action_id.len()).map_err(|_| "action id is too long".to_string())?;
    attempt.extend_from_slice(&action_len.to_be_bytes());
    attempt.extend_from_slice(binding.context.action_id.as_bytes());
    attempt.extend_from_slice(&binding.content_hash);
    attempt.extend_from_slice(&confirmation_lease_generation.to_be_bytes());
    attempt.extend_from_slice(confirm_payload_hash);
    attempt.extend_from_slice(&created_at.to_be_bytes());

    Ok(ActionDeliveryIdentity {
        slot_id,
        attempt_id: sha256::sha256(&attempt),
        attempt_created_at: *created_at,
    })
}

fn append_principal(canonical: &mut Vec<u8>, principal: candid::Principal) -> Result<(), String> {
    let raw = principal.as_slice();
    let len = u8::try_from(raw.len()).map_err(|_| "principal is too long".to_string())?;
    canonical.push(len);
    canonical.extend_from_slice(raw);
    Ok(())
}

/// Computes the exact encoded size before authority validation using fixed-width placeholders for
/// fields UserIndex will add while signing. Randomized ciphertext is caller-supplied but immutable;
/// signatures, signing ids, and card-context commitments all have fixed wire widths.
fn estimated_signed_request_size(args: &Args) -> Result<usize, String> {
    let deposits = args
        .deposits
        .iter()
        .map(|deposit| c2c_notify_actions::ActionDeposit {
            idempotency_key: deposit.idempotency_key.clone(),
            payload_hash: deposit.payload_hash.clone(),
            card_context_hash: ByteBuf::from(vec![0; c2c_notify_actions::ACTION_CARD_CONTEXT_HASH_BYTES]),
            app_revision: args.app_revision,
            action_id: args.action_id.clone(),
            consumer_key_fingerprint: deposit.consumer_key_fingerprint.clone(),
            acknowledgement_secret_hash: deposit.acknowledgement_secret_hash.clone(),
            ephemeral_public_key: deposit.ephemeral_public_key.clone(),
            ciphertext: deposit.ciphertext.clone(),
            signature_version: ecies_payload::ACTION_INBOX_SIGNATURE_VERSION_V4,
            signing_key_id: ByteBuf::from(vec![0; c2c_notify_actions::ACTION_SIGNING_KEY_ID_BYTES]),
            oc_signature: ByteBuf::from(vec![0; 64]),
            created_at: deposit.created_at,
        })
        .collect();
    validate_encoded_deposit_payload(&c2c_notify_actions::Args {
        app_id: args.app_id,
        deposits,
    })
}

fn serialize_action_inbox_request(args: &c2c_notify_actions::Args) -> Result<Vec<u8>, String> {
    let encoded = msgpack::serialize_to_vec(args).map_err(|error| format!("failed to encode action deposit relay: {error}"))?;
    if encoded.len() > c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES {
        Err(format!(
            "encoded action deposit relay is {} bytes; maximum is {} bytes",
            encoded.len(),
            c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES
        ))
    } else {
        Ok(encoded)
    }
}

fn validate_deposit_commitments(args: &Args) -> Result<(), String> {
    for deposit in &args.deposits {
        if deposit.idempotency_key.len() != c2c_notify_actions::ACTION_IDENTITY_BYTES
            || deposit.payload_hash.len() != c2c_notify_actions::ACTION_PAYLOAD_HASH_BYTES
        {
            return Err(format!(
                "idempotency_key and payload_hash must be exactly {} and {} bytes",
                c2c_notify_actions::ACTION_IDENTITY_BYTES,
                c2c_notify_actions::ACTION_PAYLOAD_HASH_BYTES
            ));
        }
    }
    Ok(())
}

fn authoritative_binding(args: &Args, caller: CanisterId) -> Result<AiAppCardAuthorityBindingV1, String> {
    match args.authority_context.chat {
        types::Chat::Direct(_) if !args.authority.is_empty() => {
            return Err("direct action deposit must not carry group route authority".to_string());
        }
        types::Chat::Direct(_) => {}
        types::Chat::Group(_) | types::Chat::Channel(_, _)
            if args.authority.len() != group_index_canister::ai_app_card_authority::AI_APP_CARD_AUTHORITY_TOKEN_BYTES =>
        {
            return Err("action deposit authority has an invalid length".to_string());
        }
        types::Chat::Group(_) | types::Chat::Channel(_, _) => {}
    }
    if args.confirmation_lease_generation == 0 || args.deposits.is_empty() {
        return Err("action deposit has no durable confirmation lease or deposits".to_string());
    }
    let context = &args.authority_context;
    if context.user_id != args.confirmed_by
        || context.app_id != args.app_id
        || context.app_revision != args.app_revision
        || context.action_id != args.action_id
    {
        return Err("action deposit routing fields do not match its authority context".to_string());
    }
    let canonical_chat_key = canonical_chat_key(context.user_id, context.chat)?;
    if context.chat_key != canonical_chat_key {
        return Err("action deposit structured chat and canonical chat key disagree".to_string());
    }
    let first = &args.deposits[0];
    let payload_hash: [u8; 32] = first
        .payload_hash
        .as_ref()
        .try_into()
        .map_err(|_| "action payload hash must be exactly 32 bytes".to_string())?;
    let expected_identity = card_identity_digest(
        &context.chat_key,
        context.thread_root_message_index.map(u32::from),
        context.message_id.as_u64(),
    );
    for deposit in &args.deposits {
        if deposit.payload_hash.as_ref() != payload_hash
            || deposit.created_at != first.created_at
            || deposit.idempotency_key.as_ref() != expected_identity
        {
            return Err("action deposit batch does not match one authoritative card/payload/timestamp".to_string());
        }
    }
    Ok(AiAppCardAuthorityBindingV1 {
        local_user_index_canister_id: caller,
        context: context.clone(),
        content_hash: args.content_hash,
        operation: AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirm_payload_hash: payload_hash,
            confirmation_lease_generation: args.confirmation_lease_generation,
            created_at: first.created_at,
        },
    })
}

fn canonical_chat_key(user_id: types::UserId, chat: types::Chat) -> Result<String, String> {
    match chat {
        types::Chat::Direct(other) => {
            let other_user_id: types::UserId = other.into();
            if other_user_id == user_id {
                return Err("direct chat participants must be distinct".to_string());
            }
            let mut pair = [user_id, other_user_id];
            pair.sort_unstable();
            Ok(format!("direct:{}:{}", pair[0], pair[1]))
        }
        types::Chat::Group(chat_id) => Ok(format!("group:{chat_id}")),
        types::Chat::Channel(community_id, channel_id) => Ok(format!("channel:{community_id}:{channel_id}")),
    }
}

fn card_identity_digest(chat_key: &str, thread_root_message_index: Option<u32>, message_id: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"openchat/action-inbox/card-identity/v3\0";
    let mut canonical = Vec::with_capacity(DOMAIN.len() + chat_key.len() + 1 + 5 + 8);
    canonical.extend_from_slice(DOMAIN);
    canonical.extend_from_slice(chat_key.as_bytes());
    canonical.push(0);
    match thread_root_message_index {
        None => canonical.push(0),
        Some(index) => {
            canonical.push(1);
            canonical.extend_from_slice(&index.to_be_bytes());
        }
    }
    canonical.extend_from_slice(&message_id.to_be_bytes());
    sha256::sha256(&canonical)
}

fn card_context_hash(
    binding: &AiAppCardAuthorityBindingV1,
    registry: &AiAppRegistry,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: CanisterId,
) -> Result<[u8; ecies_payload::ACTION_CARD_CONTEXT_HASH_BYTES], String> {
    let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
        confirm_payload_hash,
        confirmation_lease_generation,
        created_at,
    } = &binding.operation
    else {
        return Err("action authority has the wrong operation".to_string());
    };
    let app = crate::updates::create_ai_app_card_provenance::resolve_current_card_app(
        registry,
        binding.context.app_id,
        binding.context.app_revision,
        &binding.context.action_id,
    )
    .ok_or_else(|| "producing app is unavailable or stale".to_string())?;
    let app_canister_id = app
        .manifest
        .app_canister_id
        .ok_or_else(|| "producing app has no vouched app canister".to_string())?;
    let external_context = crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        &binding.context,
        app_canister_id,
        scoped_identity_key,
        user_index_canister_id,
    )?;
    ecies_payload::action_card_context_hash_v2(&ecies_payload::AppScopedActionCardContextCommitment {
        context_version: external_context.context_version,
        app_subject: external_context.app_subject.as_ref(),
        chat_handle: external_context.chat_handle.as_ref(),
        message_handle: external_context.message_handle.as_ref(),
        app_id: binding.context.app_id,
        app_revision: binding.context.app_revision,
        action_id: &binding.context.action_id,
        content_hash: &binding.content_hash,
        confirmation_lease_generation: *confirmation_lease_generation,
        created_at: *created_at,
        payload_hash: confirm_payload_hash,
    })
}

fn finish_action_deposit_admission(caller: candid::Principal, app_id: AiAppId, admitted_at: TimestampMillis) {
    mutate_state(|state| {
        state
            .data
            .ai_app_call_throttle
            .finish_action_deposit(caller, app_id, admitted_at)
    });
}

fn validate_encoded_deposit_payload<T: Serialize>(args: &T) -> Result<usize, String> {
    let encoded_bytes = msgpack::serialize_to_vec(args)
        .map_err(|error| format!("failed to encode action deposit relay: {error}"))?
        .len();
    if encoded_bytes > c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES {
        Err(format!(
            "encoded action deposit relay is {encoded_bytes} bytes; maximum is {} bytes",
            c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES
        ))
    } else {
        Ok(encoded_bytes)
    }
}

fn resolve_current_inbox(
    registry: &AiAppRegistry,
    app_id: AiAppId,
    app_revision: TimestampMillis,
) -> Result<CanisterId, String> {
    let app = registry
        .get(app_id)
        .ok_or_else(|| "producing app is not registered".to_string())?;
    if !app.published {
        return Err("producing app is not published".to_string());
    }
    if app.updated != app_revision {
        return Err("the card's app manifest revision is stale; regenerate the card".to_string());
    }
    app.manifest
        .inbox_canister_id
        .ok_or_else(|| "producing app has no vouched inbox canister".to_string())
}

fn resolve_current_route(
    registry: &AiAppRegistry,
    user_keys: &AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: CanisterId,
    args: &Args,
) -> Result<CanisterId, String> {
    if args.deposits.is_empty()
        || args.deposits.len() != args.recipient_key_bindings.len()
        || args.recipient_key_bindings.len() > MAX_RECIPIENT_KEY_BINDINGS
    {
        return Err("deposit/key-binding batch shape is invalid".to_string());
    }
    for (deposit, binding) in args.deposits.iter().zip(&args.recipient_key_bindings) {
        if binding.key_fingerprint.len() != 32 || deposit.consumer_key_fingerprint != binding.key_fingerprint {
            return Err("deposit fingerprint does not match its authoritative binding".to_string());
        }
    }
    if matches!(args.authority_context.chat, types::Chat::Direct(_))
        && !registry
            .get(args.app_id)
            .is_some_and(|app| app.published && app.updated == args.app_revision && app.manifest.per_user_keys)
    {
        return Err("direct confirmed actions require a current per-user-key app".to_string());
    }
    resolve_current_route_bindings(
        registry,
        user_keys,
        scoped_identity_key,
        user_index_canister_id,
        args.app_id,
        args.app_revision,
        &args.action_id,
        args.confirmed_by,
        &args.recipient_key_bindings,
        args.recipient_authorization.as_ref(),
    )
}

#[expect(
    clippy::too_many_arguments,
    reason = "Keep the existing current-route authorization inputs explicit without changing the caller contract"
)]
fn resolve_current_route_bindings(
    registry: &AiAppRegistry,
    user_keys: &AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: CanisterId,
    app_id: AiAppId,
    app_revision: TimestampMillis,
    action_id: &str,
    confirmed_by: UserId,
    recipient_key_bindings: &[RecipientKeyBinding],
    recipient_authorization: Option<&user_index_canister::c2c_ai_app_confirmed_action_route::RecipientAuthorizationGrant>,
) -> Result<CanisterId, String> {
    validate_recipient_key_bindings(recipient_key_bindings)?;
    let inbox = resolve_current_inbox(registry, app_id, app_revision)?;
    let app = registry.get(app_id).unwrap();
    let app_canister_id = app
        .manifest
        .app_canister_id
        .ok_or_else(|| "producing app has no vouched app canister".to_string())?;
    let action = app
        .manifest
        .actions
        .iter()
        .find(|action| action.name == action_id)
        .ok_or_else(|| "action is not declared by the producing app".to_string())?;
    let aggregate_user_count = recipient_key_bindings.iter().map(|binding| binding.user_ids.len()).sum();

    if app.manifest.per_user_keys {
        let app_authorized = matches!(action.recipient_scope, Some(types::AiActionRecipientScope::AppAuthorized));
        if app_authorized {
            let grant =
                recipient_authorization.ok_or_else(|| "app-authorized deposit is missing its recipient grant".to_string())?;
            if grant.scope_commitment.len() != 32
                || grant.expires_at
                    != grant
                        .authorization_created_at
                        .checked_add(
                            ai_app_verifier_canister::c2c_authorize_ai_action_recipients::RECIPIENT_AUTHORIZATION_TTL_MILLIS,
                        )
                        .ok_or_else(|| "recipient authorization expiry overflowed".to_string())?
                || recipient_key_bindings.is_empty()
                || !recipient_key_bindings
                    .iter()
                    .any(|binding| binding.user_ids.contains(&confirmed_by))
            {
                return Err("app-authorized deposit has an invalid recipient grant or set".to_string());
            }
        } else if recipient_authorization.is_some() {
            return Err("confirmer-only action cannot carry an app recipient grant".to_string());
        } else if recipient_key_bindings.len() != 1 || recipient_key_bindings[0].user_ids.as_slice() != [confirmed_by] {
            return Err("per-user confirmed action must target only the authoritative confirmer".to_string());
        }
        let mut supplied_users = Vec::with_capacity(aggregate_user_count);
        let mut supplied: BTreeMap<Vec<u8>, Vec<UserId>> = BTreeMap::new();
        for binding in recipient_key_bindings {
            if binding.user_ids.is_empty() {
                return Err("per-user deposit binding has no users".to_string());
            }
            let users = supplied.entry(binding.key_fingerprint.to_vec()).or_default();
            for user_id in binding.user_ids.iter().copied() {
                supplied_users.push(user_id);
                users.push(user_id);
            }
        }
        let current = user_keys
            .keys_for_users(app_id, &supplied_users)
            .map_err(|error| error.message())?;
        if current.len() != supplied_users.len() {
            return Err("a recipient app key was removed before deposit dispatch".to_string());
        }
        let mut expected: BTreeMap<Vec<u8>, Vec<UserId>> = BTreeMap::new();
        for key in current {
            expected
                .entry(
                    scoped_identity_key
                        .consumer_queue_selector(user_index_canister_id, app_id, app_canister_id, inbox, &key.public_key)?
                        .to_vec(),
                )
                .or_default()
                .push(key.user_id);
        }
        for users in supplied.values_mut().chain(expected.values_mut()) {
            users.sort_unstable();
        }
        if supplied != expected {
            return Err("a recipient app key was replaced before deposit dispatch".to_string());
        }
    } else {
        if recipient_authorization.is_some() {
            return Err("app-level action cannot carry an app recipient grant".to_string());
        }
        if recipient_key_bindings.len() != 1 || !recipient_key_bindings[0].user_ids.is_empty() {
            return Err("app-level deposit must have exactly one unscoped key binding".to_string());
        }
        let public_key = action
            .consumer_public_key
            .as_ref()
            .filter(|key| !key.is_empty())
            .unwrap_or(&app.manifest.consumer_public_key);
        if public_key.is_empty()
            || scoped_identity_key
                .consumer_queue_selector(user_index_canister_id, app_id, app_canister_id, inbox, public_key)?
                .as_slice()
                != recipient_key_bindings[0].key_fingerprint.as_ref()
        {
            return Err("the app-level delivery key changed before deposit dispatch".to_string());
        }
    }
    Ok(inbox)
}

/// Revalidates an app callback result against the exact current registry/key state and the opaque
/// grant + recipient bindings carried by LocalUserIndex. This is pure; the update entrypoint calls
/// it only after the bounded app callback returns.
#[allow(clippy::too_many_arguments)]
pub(crate) fn validate_app_authorized_callback_result(
    registry: &AiAppRegistry,
    user_keys: &AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: CanisterId,
    app_id: AiAppId,
    app_revision: TimestampMillis,
    action_id: &str,
    confirmed_by: UserId,
    callback_result: &ai_app_verifier_canister::c2c_authorize_ai_action_recipients::SuccessResult,
    expected_grant: &user_index_canister::c2c_ai_app_confirmed_action_route::RecipientAuthorizationGrant,
    recipient_key_bindings: &[RecipientKeyBinding],
    now: TimestampMillis,
) -> Result<(), String> {
    let inbox = resolve_current_inbox(registry, app_id, app_revision)?;
    let app = registry.get(app_id).expect("resolved current inbox has an app");
    let app_canister_id = app
        .manifest
        .app_canister_id
        .ok_or_else(|| "producing app has no vouched app canister".to_string())?;
    let action = app
        .manifest
        .actions
        .iter()
        .find(|action| action.name == action_id)
        .ok_or_else(|| "action is not declared by the producing app".to_string())?;
    if !app.manifest.per_user_keys || !matches!(action.recipient_scope, Some(types::AiActionRecipientScope::AppAuthorized)) {
        return Err("action does not allow app-authorized recipients".to_string());
    }
    let (routes, current_grant) = crate::updates::c2c_ai_app_confirmed_action_route::validate_app_authorized_recipients(
        confirmed_by,
        callback_result,
        app_id,
        app_canister_id,
        inbox,
        user_keys,
        scoped_identity_key,
        user_index_canister_id,
        expected_grant.authorization_created_at,
        now,
    )?;
    if &current_grant != expected_grant {
        return Err("app recipient authorization grant changed before deposit".to_string());
    }
    let expected_bindings = canonical_route_recipient_bindings(&routes)?;
    let supplied_bindings = canonical_deposit_recipient_bindings(recipient_key_bindings)?;
    if supplied_bindings != expected_bindings {
        return Err("app-authorized recipients changed before deposit".to_string());
    }
    Ok(())
}

fn canonical_route_recipient_bindings(
    routes: &[user_index_canister::c2c_ai_app_confirmed_action_route::RecipientRoute],
) -> Result<BTreeMap<Vec<u8>, Vec<UserId>>, String> {
    let mut grouped: BTreeMap<Vec<u8>, Vec<UserId>> = BTreeMap::new();
    for route in routes {
        if route.consumer_queue_selector_version != 1 || route.consumer_queue_selector.len() != 32 {
            return Err("app recipient route has an invalid selector".to_string());
        }
        grouped
            .entry(route.consumer_queue_selector.to_vec())
            .or_default()
            .push(route.user_id);
    }
    if grouped.is_empty() || grouped.len() > MAX_RECIPIENT_KEY_BINDINGS {
        return Err("app recipient routes have an invalid distinct-key count".to_string());
    }
    for users in grouped.values_mut() {
        users.sort_unstable();
    }
    Ok(grouped)
}

fn canonical_deposit_recipient_bindings(bindings: &[RecipientKeyBinding]) -> Result<BTreeMap<Vec<u8>, Vec<UserId>>, String> {
    validate_recipient_key_bindings(bindings)?;
    let mut canonical = BTreeMap::new();
    for binding in bindings {
        if binding.user_ids.is_empty() || binding.key_fingerprint.len() != 32 {
            return Err("app-authorized deposit binding is empty or malformed".to_string());
        }
        let mut users = binding.user_ids.clone();
        users.sort_unstable();
        if canonical.insert(binding.key_fingerprint.to_vec(), users).is_some() {
            return Err("one recipient selector occurs in more than one deposit binding".to_string());
        }
    }
    Ok(canonical)
}

fn pre_authority_validation_readiness(state: &mut crate::RuntimeState) -> Result<(), String> {
    if !crate::pr2_entropy::is_ready(state) {
        return Err("action-signing entropy is not ready".to_string());
    }
    state
        .data
        .action_signing_keyring
        .active_key()
        .map(|_| ())
        .ok_or_else(|| "action-signing keyring is not ready".to_string())
}

fn validate_recipient_key_bindings(recipient_key_bindings: &[RecipientKeyBinding]) -> Result<(), String> {
    if recipient_key_bindings.len() > MAX_RECIPIENT_KEY_BINDINGS {
        return Err("too many recipient key bindings".to_string());
    }
    let mut aggregate_user_count = 0usize;
    let mut supplied_user_set = BTreeSet::new();
    for binding in recipient_key_bindings {
        if binding.user_ids.len() > MAX_USERS_PER_RECIPIENT_KEY_BINDING {
            return Err("too many users in one deposit key binding".to_string());
        }
        aggregate_user_count = aggregate_user_count
            .checked_add(binding.user_ids.len())
            .ok_or_else(|| "deposit user binding count overflowed".to_string())?;
        if aggregate_user_count > MAX_BOUND_RECIPIENT_USERS {
            return Err("too many users in deposit key bindings".to_string());
        }
        for user_id in binding.user_ids.iter().copied() {
            if !supplied_user_set.insert(user_id) {
                return Err("a user occurs in more than one deposit binding".to_string());
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        AiAppCardAuthorityOperationV1, action_delivery_attempt_identity, action_delivery_identity, authoritative_binding,
        card_context_hash, card_identity_digest, estimated_signed_request_size, resolve_current_inbox, resolve_current_route,
        serialize_action_inbox_request, validate_app_authorized_callback_result, validate_deposit_commitments,
        validate_encoded_deposit_payload, validate_recipient_key_bindings,
    };
    use crate::model::action_delivery_outbox::{ActionDeliveryOutbox, ActionDeliveryOutboxError, ActionDeliveryStart};
    use crate::model::ai_app_registry::AiAppRegistry;
    use crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey;
    use crate::model::ai_app_user_keys::AiAppUserKeys;
    use action_inbox_canister::c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES;
    use ai_app_verifier_canister::c2c_authorize_ai_action_recipients as authorize_recipients;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use serde_bytes::ByteBuf;
    use types::{
        AiActionCardTemplate, AiActionDefinition, AiActionRecipientScope, AiAppCardContext, AiAppManifest, AiAppSurface, Chat,
        MessageId, SurfaceDisplay, UserId,
    };
    use user_index_canister::c2c_deposit_actions::{Args, RecipientKeyBinding, UnsignedActionDeposit};

    fn owner(value: u8) -> UserId {
        Principal::from_slice(&[value]).into()
    }

    fn manifest(name: &str, inbox: Option<Principal>) -> AiAppManifest {
        AiAppManifest {
            name: name.to_string(),
            description: String::new(),
            icon_url: None,
            app_canister_id: Some(Principal::from_slice(&[8])),
            inbox_canister_id: inbox,
            consumer_public_key: "key".to_string(),
            per_user_keys: false,
            actions: Vec::new(),
            surfaces: Vec::new(),
        }
    }

    fn valid_key(seed: u64) -> String {
        P256KeyPair::new(&mut StdRng::seed_from_u64(seed))
            .public_key_pem()
            .to_string()
    }

    fn delivery_manifest(name: &str, inbox: Principal, per_user_keys: bool, app_key: String) -> AiAppManifest {
        let mut value = manifest(name, Some(inbox));
        value.per_user_keys = per_user_keys;
        value.consumer_public_key = app_key;
        value.actions = vec![AiActionDefinition {
            name: "sample.action".to_string(),
            description: String::new(),
            prompt_template: String::new(),
            response_schema: "{}".to_string(),
            card: AiActionCardTemplate {
                title: String::new(),
                confirm_label: String::new(),
                cancel_label: String::new(),
                rows: Vec::new(),
                disclosure: None,
            },
            endpoint: String::new(),
            consumer_public_key: None,
            recipient_scope: None,
            rules: Vec::new(),
            accepts_image: false,
        }];
        value.surfaces = vec![AiAppSurface {
            kind: "card".to_string(),
            url: "https://app.example/card".to_string(),
            display: SurfaceDisplay::Sheet,
        }];
        value
    }

    #[allow(clippy::too_many_arguments)]
    fn authorized_recipient(
        user_id: UserId,
        public_key: String,
        app_id: u32,
        app_canister: Principal,
        inbox: Principal,
        user_index: Principal,
        keys: &AiAppUserKeys,
        scoped: &AiAppScopedIdentityKey,
    ) -> authorize_recipients::AuthorizedRecipient {
        authorize_recipients::AuthorizedRecipient {
            app_subject: ByteBuf::from(
                scoped
                    .app_subject(user_index, app_id, app_canister, user_id)
                    .unwrap()
                    .to_vec(),
            ),
            subject_version: authorize_recipients::APP_SUBJECT_VERSION_V1,
            consumer_queue_selector: ByteBuf::from(
                scoped
                    .consumer_queue_selector(user_index, app_id, app_canister, inbox, &public_key)
                    .unwrap()
                    .to_vec(),
            ),
            consumer_queue_selector_version: authorize_recipients::CONSUMER_QUEUE_SELECTOR_VERSION_V1,
            consumer_public_key: public_key,
            app_user_key_version: keys.binding_version(user_id, app_id).unwrap(),
        }
    }

    fn authority_context(user_id: UserId, app_id: u32, app_revision: u64) -> AiAppCardContext {
        let group = Principal::from_slice(&[9]);
        AiAppCardContext {
            user_id,
            chat: Chat::Group(group.into()),
            chat_key: format!("group:{group}"),
            thread_root_message_index: None,
            message_id: MessageId::from(1u64),
            app_id,
            app_revision,
            action_id: "sample.action".to_string(),
        }
    }

    fn deposit(fingerprint: Vec<u8>) -> UnsignedActionDeposit {
        let context = authority_context(owner(1), 1, 2);
        UnsignedActionDeposit {
            idempotency_key: ByteBuf::from(card_identity_digest(&context.chat_key, None, context.message_id.as_u64()).to_vec()),
            payload_hash: ByteBuf::from(vec![7; 32]),
            consumer_key_fingerprint: ByteBuf::from(fingerprint),
            acknowledgement_secret_hash: ByteBuf::from(vec![5; 32]),
            ephemeral_public_key: ByteBuf::from(vec![2; 65]),
            ciphertext: ByteBuf::from(vec![3; 32]),
            created_at: 1,
        }
    }

    fn relay_args(
        confirmed_by: UserId,
        app_id: u32,
        app_revision: u64,
        recipient_key_bindings: Vec<RecipientKeyBinding>,
        deposits: Vec<UnsignedActionDeposit>,
    ) -> Args {
        Args {
            authority_context: authority_context(confirmed_by, app_id, app_revision),
            content_hash: [3; 32],
            confirmation_lease_generation: 1,
            authority: ByteBuf::from(vec![
                4;
                group_index_canister::ai_app_card_authority::AI_APP_CARD_AUTHORITY_TOKEN_BYTES
            ]),
            confirmed_by,
            app_id,
            app_revision,
            action_id: "sample.action".to_string(),
            recipient_authorization: None,
            recipient_key_bindings,
            deposits,
        }
    }
    fn direct_relay_args(confirmed_by: UserId, peer: UserId, authority: ByteBuf) -> Args {
        let mut args = relay_args(confirmed_by, 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let mut pair = [confirmed_by, peer];
        pair.sort_unstable();
        let chat_key = format!("direct:{}:{}", pair[0], pair[1]);
        args.authority_context.chat = Chat::Direct(peer.into());
        args.authority_context.chat_key = chat_key.clone();
        args.authority = authority;
        args.deposits[0].idempotency_key = ByteBuf::from(
            card_identity_digest(
                &chat_key,
                args.authority_context.thread_root_message_index.map(u32::from),
                args.authority_context.message_id.as_u64(),
            )
            .to_vec(),
        );
        args
    }

    #[test]
    fn legacy_deposit_args_msgpack_defaults_to_no_recipient_authorization() {
        #[derive(serde::Serialize)]
        struct LegacyArgs<'a> {
            authority_context: &'a AiAppCardContext,
            content_hash: [u8; 32],
            confirmation_lease_generation: u64,
            authority: &'a ByteBuf,
            confirmed_by: UserId,
            app_id: u32,
            app_revision: u64,
            action_id: &'a str,
            recipient_key_bindings: &'a [RecipientKeyBinding],
            deposits: &'a [UnsignedActionDeposit],
        }

        let current = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let encoded = msgpack::serialize_to_vec(&LegacyArgs {
            authority_context: &current.authority_context,
            content_hash: current.content_hash,
            confirmation_lease_generation: current.confirmation_lease_generation,
            authority: &current.authority,
            confirmed_by: current.confirmed_by,
            app_id: current.app_id,
            app_revision: current.app_revision,
            action_id: &current.action_id,
            recipient_key_bindings: &current.recipient_key_bindings,
            deposits: &current.deposits,
        })
        .unwrap();
        let decoded: Args = msgpack::deserialize(encoded.as_slice()).unwrap();
        assert!(decoded.recipient_authorization.is_none());
        assert_eq!(decoded.confirmed_by, current.confirmed_by);
        assert_eq!(decoded.deposits.len(), 1);
    }

    #[test]
    fn relay_builds_only_the_exact_groupindex_authority_binding() {
        let confirmed_by = owner(1);
        let caller = Principal::from_slice(&[77]);
        let args = relay_args(confirmed_by, 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let binding = authoritative_binding(&args, caller).unwrap();

        assert_eq!(binding.local_user_index_canister_id, caller);
        assert_eq!(binding.context, args.authority_context);
        assert_eq!(binding.content_hash, args.content_hash);
        assert!(matches!(
            binding.operation,
            group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::DepositConfirmedAction {
                confirm_payload_hash,
                confirmation_lease_generation: 1,
                created_at: 1,
            } if confirm_payload_hash == [7; 32]
        ));
    }

    #[test]
    fn indexed_confirmers_in_one_canister_have_distinct_delivery_attempts() {
        let host = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let first = UserId::new_indexed(host, 1);
        let second = UserId::new_indexed(host, 2);
        let caller = Principal::from_slice(&[77]);
        let first_args = relay_args(first, 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let first_binding = authoritative_binding(&first_args, caller).unwrap();
        let mut second_binding = first_binding.clone();
        second_binding.context.user_id = second;
        assert_ne!(
            action_delivery_attempt_identity(&first_binding).unwrap(),
            action_delivery_attempt_identity(&second_binding).unwrap()
        );

        let first_direct = direct_relay_args(first, second, ByteBuf::new());
        let second_direct = direct_relay_args(second, first, ByteBuf::new());
        let first_identity = action_delivery_identity(&authoritative_binding(&first_direct, caller).unwrap()).unwrap();
        let second_identity = action_delivery_identity(&authoritative_binding(&second_direct, caller).unwrap()).unwrap();
        assert_eq!(first_identity.slot_id, second_identity.slot_id);
        assert_ne!(first_identity.attempt_id, second_identity.attempt_id);
    }

    #[test]
    fn outbox_attempt_identity_commits_every_raw_authoritative_coordinate() {
        let caller = Principal::from_slice(&[77]);
        let args = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let binding = authoritative_binding(&args, caller).unwrap();
        let baseline = action_delivery_attempt_identity(&binding).unwrap().0;

        let mut variants = Vec::new();
        let mut changed = binding.clone();
        changed.local_user_index_canister_id = Principal::from_slice(&[78]);
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.chat = Chat::Group(Principal::from_slice(&[10]).into());
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.thread_root_message_index = Some(3u32.into());
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.message_id = MessageId::from(2u64);
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.user_id = owner(2);
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.app_id += 1;
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.app_revision += 1;
        variants.push(changed);
        let mut changed = binding.clone();
        changed.context.action_id.push_str(".changed");
        variants.push(changed);
        let mut changed = binding.clone();
        changed.content_hash[0] ^= 1;
        variants.push(changed);
        let mut changed = binding.clone();
        let group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirmation_lease_generation,
            ..
        } = &mut changed.operation
        else {
            unreachable!()
        };
        *confirmation_lease_generation += 1;
        variants.push(changed);
        let mut changed = binding.clone();
        let group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirm_payload_hash,
            ..
        } = &mut changed.operation
        else {
            unreachable!()
        };
        confirm_payload_hash[0] ^= 1;
        variants.push(changed);
        let mut changed = binding.clone();
        let group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            created_at,
            ..
        } = &mut changed.operation
        else {
            unreachable!()
        };
        *created_at += 1;
        variants.push(changed);

        for variant in variants {
            assert_ne!(action_delivery_attempt_identity(&variant).unwrap().0, baseline);
        }
    }

    #[test]
    fn direct_participants_with_distinct_luis_and_keys_compete_for_one_logical_slot() {
        let alice = owner(1);
        let bob = owner(2);
        let mut alice_args = direct_relay_args(alice, bob, ByteBuf::new());
        alice_args.deposits[0].consumer_key_fingerprint = ByteBuf::from(vec![11; 32]);
        let mut bob_args = direct_relay_args(bob, alice, ByteBuf::new());
        bob_args.deposits[0].consumer_key_fingerprint = ByteBuf::from(vec![22; 32]);

        let alice_identity =
            action_delivery_identity(&authoritative_binding(&alice_args, Principal::from_slice(&[71])).unwrap()).unwrap();
        let bob_identity =
            action_delivery_identity(&authoritative_binding(&bob_args, Principal::from_slice(&[72])).unwrap()).unwrap();

        assert_eq!(alice_identity.slot_id, bob_identity.slot_id);
        assert_ne!(alice_identity.attempt_id, bob_identity.attempt_id);

        let mut outbox = ActionDeliveryOutbox::default();
        assert_eq!(
            outbox.start_in_slot(
                alice_identity.slot_id,
                alice_identity.attempt_id,
                alice_args.app_id,
                1,
                alice_identity.attempt_created_at,
                alice_identity.attempt_created_at,
            ),
            Ok(ActionDeliveryStart::Prepare { epoch: 1 })
        );
        assert_eq!(
            outbox.start_in_slot(
                bob_identity.slot_id,
                bob_identity.attempt_id,
                bob_args.app_id,
                1,
                bob_identity.attempt_created_at,
                bob_identity.attempt_created_at,
            ),
            Err(ActionDeliveryOutboxError::IdentityCollision)
        );
    }

    #[test]
    fn direct_exact_retry_reuses_slot_but_changed_payload_or_lease_conflicts() {
        let alice = owner(1);
        let bob = owner(2);
        let caller = Principal::from_slice(&[71]);
        let args = direct_relay_args(alice, bob, ByteBuf::new());
        let binding = authoritative_binding(&args, caller).unwrap();
        let baseline = action_delivery_identity(&binding).unwrap();
        let exact_retry =
            action_delivery_identity(&authoritative_binding(&args, Principal::from_slice(&[72])).unwrap()).unwrap();
        assert_eq!(baseline, exact_retry);

        let mut changed_payload_binding = binding.clone();
        let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirm_payload_hash, ..
        } = &mut changed_payload_binding.operation
        else {
            unreachable!()
        };
        confirm_payload_hash[0] ^= 1;
        let changed_payload = action_delivery_identity(&changed_payload_binding).unwrap();

        let mut changed_lease_binding = binding.clone();
        let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirmation_lease_generation,
            ..
        } = &mut changed_lease_binding.operation
        else {
            unreachable!()
        };
        *confirmation_lease_generation += 1;
        let changed_lease = action_delivery_identity(&changed_lease_binding).unwrap();

        let mut changed_created_at_binding = binding;
        let AiAppCardAuthorityOperationV1::DepositConfirmedAction { created_at, .. } =
            &mut changed_created_at_binding.operation
        else {
            unreachable!()
        };
        *created_at += 1;
        let changed_created_at = action_delivery_identity(&changed_created_at_binding).unwrap();

        for changed in [changed_payload, changed_lease, changed_created_at] {
            assert_eq!(baseline.slot_id, changed.slot_id);
            assert_ne!(baseline.attempt_id, changed.attempt_id);
        }

        let exact_prepared_request = vec![8, 6, 7, 5, 3, 0, 9];
        let mut outbox = ActionDeliveryOutbox::default();
        assert_eq!(
            outbox.start_in_slot(
                baseline.slot_id,
                baseline.attempt_id,
                args.app_id,
                exact_prepared_request.len(),
                baseline.attempt_created_at,
                baseline.attempt_created_at,
            ),
            Ok(ActionDeliveryStart::Prepare { epoch: 1 })
        );
        assert!(matches!(
            outbox.store_prepared(
                baseline.attempt_id,
                1,
                Principal::from_slice(&[9]),
                vec![0; exact_prepared_request.len() + 1],
                baseline.attempt_created_at,
            ),
            Err(ActionDeliveryOutboxError::InvalidRequestSize)
        ));
        let prepared = outbox
            .store_prepared(
                baseline.attempt_id,
                1,
                Principal::from_slice(&[9]),
                exact_prepared_request.clone(),
                baseline.attempt_created_at,
            )
            .unwrap();
        assert_eq!(prepared.request, exact_prepared_request);
        assert_eq!(
            outbox.start_in_slot(
                exact_retry.slot_id,
                exact_retry.attempt_id,
                args.app_id,
                exact_prepared_request.len(),
                exact_retry.attempt_created_at,
                exact_retry.attempt_created_at,
            ),
            Ok(ActionDeliveryStart::Pending)
        );
        for changed in [changed_payload, changed_lease, changed_created_at] {
            assert_eq!(
                outbox.start_in_slot(
                    changed.slot_id,
                    changed.attempt_id,
                    args.app_id,
                    exact_prepared_request.len(),
                    changed.attempt_created_at,
                    changed.attempt_created_at,
                ),
                Err(ActionDeliveryOutboxError::IdentityCollision)
            );
        }
    }

    #[test]
    fn non_direct_delivery_keeps_its_attempt_identity_as_the_slot() {
        let args = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let identity = action_delivery_identity(&authoritative_binding(&args, Principal::from_slice(&[77])).unwrap()).unwrap();

        assert_eq!(identity.slot_id, identity.attempt_id);
    }

    #[test]
    fn recipient_authorization_clock_cannot_fork_the_delivery_or_outbox_identity() {
        let caller = Principal::from_slice(&[77]);
        let mut args = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        args.recipient_authorization = Some(
            user_index_canister::c2c_ai_app_confirmed_action_route::RecipientAuthorizationGrant {
                scope_commitment: ByteBuf::from(vec![4; 32]),
                authorization_created_at: 1_000,
                expires_at: 301_000,
            },
        );
        let baseline = action_delivery_identity(&authoritative_binding(&args, caller).unwrap()).unwrap();

        let grant = args.recipient_authorization.as_mut().unwrap();
        grant.scope_commitment[0] ^= 1;
        grant.authorization_created_at = 2_000;
        grant.expires_at = 302_000;
        let refreshed = action_delivery_identity(&authoritative_binding(&args, caller).unwrap()).unwrap();
        assert_eq!(refreshed, baseline);

        let mut outbox = ActionDeliveryOutbox::default();
        let exact_prepared_request = vec![8, 6, 7, 5, 3, 0, 9];
        assert_eq!(
            outbox.start_in_slot(
                baseline.slot_id,
                baseline.attempt_id,
                args.app_id,
                exact_prepared_request.len(),
                baseline.attempt_created_at,
                baseline.attempt_created_at,
            ),
            Ok(ActionDeliveryStart::Prepare { epoch: 1 })
        );
        let prepared = outbox
            .store_prepared(
                baseline.attempt_id,
                1,
                Principal::from_slice(&[9]),
                exact_prepared_request.clone(),
                baseline.attempt_created_at,
            )
            .unwrap();
        assert_eq!(prepared.request, exact_prepared_request);
        assert_eq!(
            outbox.start_in_slot(
                refreshed.slot_id,
                refreshed.attempt_id,
                args.app_id,
                1,
                refreshed.attempt_created_at,
                refreshed.attempt_created_at,
            ),
            Ok(ActionDeliveryStart::Pending)
        );
        assert_eq!(
            outbox.dispatch(refreshed.attempt_id).unwrap().request,
            exact_prepared_request,
            "a refreshed authorization can never replace an already prepared exact request"
        );
    }

    #[test]
    fn signed_request_reservation_matches_exact_fixed_width_wire_size() {
        let args = relay_args(owner(1), 7, 9, Vec::new(), vec![deposit(vec![1; 32])]);
        let estimated = estimated_signed_request_size(&args).unwrap();
        let deposit = &args.deposits[0];
        let exact = action_inbox_canister::c2c_notify_actions::Args {
            app_id: args.app_id,
            deposits: vec![action_inbox_canister::c2c_notify_actions::ActionDeposit {
                idempotency_key: deposit.idempotency_key.clone(),
                payload_hash: deposit.payload_hash.clone(),
                card_context_hash: ByteBuf::from(vec![9; 32]),
                app_revision: args.app_revision,
                action_id: args.action_id.clone(),
                consumer_key_fingerprint: deposit.consumer_key_fingerprint.clone(),
                acknowledgement_secret_hash: deposit.acknowledgement_secret_hash.clone(),
                ephemeral_public_key: deposit.ephemeral_public_key.clone(),
                ciphertext: deposit.ciphertext.clone(),
                signature_version: ecies_payload::ACTION_INBOX_SIGNATURE_VERSION_V4,
                signing_key_id: ByteBuf::from(vec![8; 32]),
                oc_signature: ByteBuf::from(vec![7; 64]),
                created_at: deposit.created_at,
            }],
        };
        assert_eq!(serialize_action_inbox_request(&exact).unwrap().len(), estimated);
    }

    #[test]
    fn signed_context_commits_only_the_app_scoped_external_identity() {
        let confirmed_by = owner(42);
        let inbox = Principal::from_slice(&[10]);
        let user_index = Principal::from_slice(&[77]);
        let mut registry = AiAppRegistry::default();
        let app = registry
            .register(
                owner(1),
                delivery_manifest("scoped-context", inbox, false, valid_key(58)),
                1,
                false,
            )
            .unwrap();
        assert!(registry.publish(app.id, 2));
        let revision = registry.get(app.id).unwrap().updated;
        let args = relay_args(confirmed_by, app.id, revision, Vec::new(), vec![deposit(vec![1; 32])]);
        let binding = authoritative_binding(&args, Principal::from_slice(&[6])).unwrap();
        let mut scoped_key = AiAppScopedIdentityKey::default();
        scoped_key.ensure_initialized(&mut StdRng::seed_from_u64(58)).unwrap();

        let baseline = card_context_hash(&binding, &registry, &scoped_key, user_index).unwrap();
        let mut different_message = binding.clone();
        different_message.context.message_id = MessageId::from(2u64);
        let changed = card_context_hash(&different_message, &registry, &scoped_key, user_index).unwrap();

        assert_ne!(baseline, changed);
        assert_ne!(baseline, [0; 32]);
    }

    #[test]
    fn relay_rejects_mutated_private_context() {
        let caller = Principal::from_slice(&[77]);

        let mut mismatch = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        mismatch.authority_context.user_id = owner(2);
        assert!(authoritative_binding(&mismatch, caller).is_err());

        let mut noncanonical = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        noncanonical.authority_context.chat_key.push_str(":redirected");
        assert!(authoritative_binding(&noncanonical, caller).is_err());
    }

    #[test]
    fn direct_deposit_accepts_the_canonical_pair_without_groupindex_authority() {
        let caller = Principal::from_slice(&[77]);
        let args = direct_relay_args(owner(1), owner(2), ByteBuf::new());
        let binding = authoritative_binding(&args, caller)
            .expect("the confirmer's current home LUI must relay a canonical direct deposit without GroupIndex authority");

        assert_eq!(binding.context, args.authority_context);
        assert_eq!(binding.local_user_index_canister_id, caller);
    }

    #[test]
    fn direct_deposit_rejects_nonempty_groupindex_authority() {
        let caller = Principal::from_slice(&[77]);
        let args = direct_relay_args(
            owner(1),
            owner(2),
            ByteBuf::from(vec![
                4;
                group_index_canister::ai_app_card_authority::AI_APP_CARD_AUTHORITY_TOKEN_BYTES
            ]),
        );
        assert_eq!(
            authoritative_binding(&args, caller).unwrap_err(),
            "direct action deposit must not carry group route authority"
        );
    }

    #[test]
    fn direct_deposit_rejects_a_self_chat() {
        let caller = Principal::from_slice(&[77]);
        let args = direct_relay_args(owner(1), owner(1), ByteBuf::new());
        assert!(authoritative_binding(&args, caller).is_err());
    }

    #[test]
    fn relay_rejects_batch_mutations_before_validating_authority() {
        let caller = Principal::from_slice(&[77]);

        let mut wrong_identity = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        wrong_identity.deposits[0].idempotency_key[31] ^= 1;
        assert!(authoritative_binding(&wrong_identity, caller).is_err());

        let mut split_payload = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32]), deposit(vec![2; 32])]);
        split_payload.deposits[1].payload_hash[31] ^= 1;
        assert!(authoritative_binding(&split_payload, caller).is_err());

        let mut split_timestamp = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32]), deposit(vec![2; 32])]);
        split_timestamp.deposits[1].created_at += 1;
        assert!(authoritative_binding(&split_timestamp, caller).is_err());

        let mut no_lease = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        no_lease.confirmation_lease_generation = 0;
        assert!(authoritative_binding(&no_lease, caller).is_err());

        let mut bad_token = relay_args(owner(1), 1, 2, Vec::new(), vec![deposit(vec![1; 32])]);
        let short_token_len = bad_token.authority.len() - 1;
        bad_token.authority.truncate(short_token_len);
        assert!(authoritative_binding(&bad_token, caller).is_err());

        let empty = relay_args(owner(1), 1, 2, Vec::new(), Vec::new());
        assert!(authoritative_binding(&empty, caller).is_err());
    }

    #[test]
    fn relay_derives_each_apps_current_published_inbox() {
        let mut registry = AiAppRegistry::default();
        let inbox_a = Principal::from_slice(&[10]);
        let inbox_b = Principal::from_slice(&[11]);
        let app_a = registry
            .register(owner(1), manifest("app-a", Some(inbox_a)), 1, false)
            .unwrap();
        let app_b = registry
            .register(owner(2), manifest("app-b", Some(inbox_b)), 1, false)
            .unwrap();
        assert!(registry.publish(app_a.id, 2));
        assert!(registry.publish(app_b.id, 2));
        let revision_a = registry.get(app_a.id).unwrap().updated;
        let revision_b = registry.get(app_b.id).unwrap().updated;

        assert_eq!(resolve_current_inbox(&registry, app_a.id, revision_a), Ok(inbox_a));
        assert_eq!(resolve_current_inbox(&registry, app_b.id, revision_b), Ok(inbox_b));
    }

    #[test]
    fn relay_rejects_unpublished_missing_and_stale_routes() {
        let mut registry = AiAppRegistry::default();
        let inbox = Principal::from_slice(&[10]);
        let draft = registry.register(owner(1), manifest("draft", Some(inbox)), 1, false).unwrap();
        assert!(resolve_current_inbox(&registry, draft.id, draft.updated).is_err());
        assert!(resolve_current_inbox(&registry, u32::MAX, 1).is_err());

        assert!(registry.publish(draft.id, 2));
        let current = registry.get(draft.id).unwrap().updated;
        assert!(resolve_current_inbox(&registry, draft.id, current.saturating_sub(1)).is_err());
        assert_eq!(resolve_current_inbox(&registry, draft.id, current), Ok(inbox));

        let changed = registry
            .register(owner(1), manifest("draft", Some(Principal::from_slice(&[12]))), 3, false)
            .unwrap();
        assert!(!changed.published);
        assert!(resolve_current_inbox(&registry, draft.id, current).is_err());
    }

    #[test]
    fn relay_rejects_aggregate_bytes_before_the_outbound_await() {
        let deposit = |id: u64| {
            let mut value = deposit(vec![1; 32]);
            value.idempotency_key[24..].copy_from_slice(&id.to_be_bytes());
            value.ciphertext = ByteBuf::from(vec![3; 64 * 1024]);
            value.created_at = u64::MAX;
            value
        };
        let oversized = relay_args(owner(1), u32::MAX, u64::MAX, Vec::new(), (0..17).map(deposit).collect());
        assert!(validate_encoded_deposit_payload(&oversized).is_err());

        let adjacent = relay_args(owner(1), u32::MAX, u64::MAX, Vec::new(), (0..8).map(deposit).collect());
        let encoded = validate_encoded_deposit_payload(&adjacent).unwrap();
        assert!(encoded < MAX_DEPOSIT_BATCH_ENCODED_BYTES);
    }

    #[test]
    fn relay_requires_full_width_identity_and_payload_commitments_before_route_lookup() {
        let args_with = |identity_len: usize, payload_len: usize| {
            let mut action = deposit(vec![1; 32]);
            action.idempotency_key = ByteBuf::from(vec![6; identity_len]);
            action.payload_hash = ByteBuf::from(vec![7; payload_len]);
            relay_args(owner(1), u32::MAX, u64::MAX, Vec::new(), vec![action])
        };

        assert_eq!(validate_deposit_commitments(&args_with(32, 32)), Ok(()));
        for (identity_len, payload_len) in [(31, 32), (33, 32), (32, 31), (32, 33), (0, 32), (32, 0), (0, 0)] {
            assert!(
                validate_deposit_commitments(&args_with(identity_len, payload_len)).is_err(),
                "accepted identity={identity_len}, payload={payload_len}"
            );
        }
    }

    #[test]
    fn recipient_binding_counts_are_bounded_and_duplicates_reject_linearly() {
        use user_index_canister::c2c_deposit_actions::{
            MAX_BOUND_RECIPIENT_USERS, MAX_USERS_PER_RECIPIENT_KEY_BINDING, RecipientKeyBinding,
        };

        let binding = |start: u8, count: usize| RecipientKeyBinding {
            user_ids: (0..count).map(|offset| owner(start + offset as u8)).collect(),
            key_fingerprint: ByteBuf::from(vec![start; 32]),
        };
        let exact: Vec<_> = (0..8).map(|index| binding(index * 8 + 1, 8)).collect();
        assert_eq!(
            exact.iter().map(|value| value.user_ids.len()).sum::<usize>(),
            MAX_BOUND_RECIPIENT_USERS
        );
        assert_eq!(validate_recipient_key_bindings(&exact), Ok(()));

        let mut over_aggregate = exact.clone();
        over_aggregate[7].user_ids.push(owner(65));
        assert!(validate_recipient_key_bindings(&over_aggregate).is_err());

        let oversized_single = vec![binding(1, MAX_USERS_PER_RECIPIENT_KEY_BINDING + 1)];
        assert!(validate_recipient_key_bindings(&oversized_single).is_err());

        for duplicate_index in [0, 31, 63] {
            let mut duplicate = exact.clone();
            let repeated = if duplicate_index == 0 { duplicate[7].user_ids[7] } else { duplicate[0].user_ids[0] };
            duplicate[duplicate_index / 8].user_ids[duplicate_index % 8] = repeated;
            assert!(
                validate_recipient_key_bindings(&duplicate).is_err(),
                "accepted duplicate at aggregate index {duplicate_index}"
            );
        }

        let unsorted = vec![RecipientKeyBinding {
            user_ids: vec![owner(3), owner(1), owner(2)],
            key_fingerprint: ByteBuf::from(vec![1; 32]),
        }];
        assert_eq!(validate_recipient_key_bindings(&unsorted), Ok(()));
        assert_eq!(validate_recipient_key_bindings(&[]), Ok(()));
    }

    #[test]
    fn per_user_key_removal_or_replacement_in_the_lui_await_gap_rejects_the_batch() {
        let mut registry = AiAppRegistry::default();
        let mut keys = AiAppUserKeys::default();
        let recipient = owner(44);
        let key_v1 = valid_key(1);
        let key_v2 = valid_key(2);
        let inbox = Principal::from_slice(&[10]);
        let app = registry
            .register(owner(1), delivery_manifest("per-user", inbox, true, String::new()), 1, false)
            .unwrap();
        assert!(registry.publish(app.id, 2));
        let revision = registry.get(app.id).unwrap().updated;
        keys.set(recipient, app.id, key_v1.clone()).unwrap();
        let user_index = Principal::from_slice(&[77]);
        let mut scoped_identity_key = AiAppScopedIdentityKey::default();
        scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(99))
            .unwrap();
        let app_canister = registry.get(app.id).unwrap().manifest.app_canister_id.unwrap();
        let fingerprint = scoped_identity_key
            .consumer_queue_selector(user_index, app.id, app_canister, inbox, &key_v1)
            .unwrap()
            .to_vec();
        let args = relay_args(
            recipient,
            app.id,
            revision,
            vec![user_index_canister::c2c_deposit_actions::RecipientKeyBinding {
                user_ids: vec![recipient],
                key_fingerprint: ByteBuf::from(fingerprint.clone()),
            }],
            vec![deposit(fingerprint)],
        );
        assert_eq!(
            resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &args),
            Ok(inbox)
        );

        keys.set(recipient, app.id, key_v2).unwrap();
        assert!(resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &args).is_err());
        keys.remove(recipient, app.id).unwrap();
        assert!(resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &args).is_err());
    }

    #[test]
    fn app_authorized_callback_requires_exact_current_recipients_and_groups_a_shared_key() {
        let mut registry = AiAppRegistry::default();
        let inbox = Principal::from_slice(&[10]);
        let mut manifest = delivery_manifest("account-scoped", inbox, true, String::new());
        manifest.actions[0].recipient_scope = Some(AiActionRecipientScope::AppAuthorized);
        let app = registry.register(owner(1), manifest, 1, false).unwrap();
        assert!(registry.publish(app.id, 2));
        let current = registry.get(app.id).unwrap();
        let revision = current.updated;
        let app_canister = current.manifest.app_canister_id.unwrap();
        let confirmer = owner(41);
        let partner = owner(42);
        let unrelated = owner(43);
        let shared_key = valid_key(201);
        let mut keys = AiAppUserKeys::default();
        keys.set(confirmer, app.id, shared_key.clone()).unwrap();
        keys.set(partner, app.id, shared_key.clone()).unwrap();
        keys.set(unrelated, app.id, valid_key(202)).unwrap();
        let user_index = Principal::from_slice(&[77]);
        let mut scoped = AiAppScopedIdentityKey::default();
        scoped.ensure_initialized(&mut StdRng::seed_from_u64(203)).unwrap();
        let mut recipients = vec![
            authorized_recipient(
                confirmer,
                shared_key.clone(),
                app.id,
                app_canister,
                inbox,
                user_index,
                &keys,
                &scoped,
            ),
            authorized_recipient(
                partner,
                shared_key.clone(),
                app.id,
                app_canister,
                inbox,
                user_index,
                &keys,
                &scoped,
            ),
        ];
        recipients.sort_unstable_by(|left, right| left.app_subject.as_ref().cmp(right.app_subject.as_ref()));
        let authorization_created_at = 1_000;
        let callback_result = authorize_recipients::SuccessResult {
            recipients,
            scope_commitment: ByteBuf::from(vec![9; authorize_recipients::SCOPE_COMMITMENT_BYTES]),
            expires_at: authorization_created_at + authorize_recipients::RECIPIENT_AUTHORIZATION_TTL_MILLIS,
        };
        let grant = user_index_canister::c2c_ai_app_confirmed_action_route::RecipientAuthorizationGrant {
            scope_commitment: callback_result.scope_commitment.clone(),
            authorization_created_at,
            expires_at: callback_result.expires_at,
        };
        let selector = scoped
            .consumer_queue_selector(user_index, app.id, app_canister, inbox, &shared_key)
            .unwrap()
            .to_vec();
        let exact_binding = RecipientKeyBinding {
            user_ids: vec![partner, confirmer],
            key_fingerprint: ByteBuf::from(selector.clone()),
        };
        assert_eq!(
            validate_app_authorized_callback_result(
                &registry,
                &keys,
                &scoped,
                user_index,
                app.id,
                revision,
                "sample.action",
                confirmer,
                &callback_result,
                &grant,
                std::slice::from_ref(&exact_binding),
                authorization_created_at,
            ),
            Ok(())
        );

        // A linked but unselected user is not implicitly added. Replacing the exact partner with
        // that user no longer matches the app's callback decision.
        let unrelated_selector = scoped
            .consumer_queue_selector(
                user_index,
                app.id,
                app_canister,
                inbox,
                &keys.keys_for_users(app.id, &[unrelated]).unwrap()[0].public_key,
            )
            .unwrap()
            .to_vec();
        assert!(
            validate_app_authorized_callback_result(
                &registry,
                &keys,
                &scoped,
                user_index,
                app.id,
                revision,
                "sample.action",
                confirmer,
                &callback_result,
                &grant,
                &[RecipientKeyBinding {
                    user_ids: vec![confirmer, unrelated],
                    key_fingerprint: ByteBuf::from(unrelated_selector),
                }],
                authorization_created_at,
            )
            .is_err()
        );
        assert!(
            validate_app_authorized_callback_result(
                &registry,
                &keys,
                &scoped,
                user_index,
                app.id,
                revision,
                "sample.action",
                confirmer,
                &callback_result,
                &grant,
                &[RecipientKeyBinding {
                    user_ids: vec![confirmer],
                    key_fingerprint: ByteBuf::from(selector),
                }],
                authorization_created_at,
            )
            .is_err()
        );

        let mut changed_grant = grant.clone();
        changed_grant.scope_commitment[0] ^= 1;
        assert!(
            validate_app_authorized_callback_result(
                &registry,
                &keys,
                &scoped,
                user_index,
                app.id,
                revision,
                "sample.action",
                confirmer,
                &callback_result,
                &changed_grant,
                std::slice::from_ref(&exact_binding),
                authorization_created_at,
            )
            .is_err()
        );

        keys.set(partner, app.id, valid_key(204)).unwrap();
        assert!(
            validate_app_authorized_callback_result(
                &registry,
                &keys,
                &scoped,
                user_index,
                app.id,
                revision,
                "sample.action",
                confirmer,
                &callback_result,
                &grant,
                &[exact_binding],
                authorization_created_at,
            )
            .is_err()
        );
    }

    #[test]
    fn app_level_route_requires_the_stable_secret_derived_queue_selector() {
        let mut registry = AiAppRegistry::default();
        let keys = AiAppUserKeys::default();
        let inbox = Principal::from_slice(&[10]);
        let public_key = valid_key(3);
        let app = registry
            .register(
                owner(1),
                delivery_manifest("app-level", inbox, false, public_key.clone()),
                1,
                false,
            )
            .unwrap();
        assert!(registry.publish(app.id, 2));
        let current = registry.get(app.id).unwrap();
        let revision = current.updated;
        let app_canister = current.manifest.app_canister_id.unwrap();
        let user_index = Principal::from_slice(&[77]);
        let mut scoped_identity_key = AiAppScopedIdentityKey::default();
        scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(100))
            .unwrap();
        let selector = scoped_identity_key
            .consumer_queue_selector(user_index, app.id, app_canister, inbox, &public_key)
            .unwrap()
            .to_vec();
        let args = relay_args(
            owner(44),
            app.id,
            revision,
            vec![RecipientKeyBinding {
                user_ids: Vec::new(),
                key_fingerprint: ByteBuf::from(selector.clone()),
            }],
            vec![deposit(selector)],
        );

        assert_eq!(
            resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &args),
            Ok(inbox)
        );

        let mut forged = args;
        forged.recipient_key_bindings[0].key_fingerprint[0] ^= 1;
        forged.deposits[0].consumer_key_fingerprint[0] ^= 1;
        assert!(resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &forged).is_err());

        forged.recipient_key_bindings[0].key_fingerprint[0] ^= 1;
        forged.deposits[0].consumer_key_fingerprint[0] ^= 1;
        let peer = owner(45);
        let mut pair = [forged.confirmed_by, peer];
        pair.sort_unstable();
        forged.authority_context.chat = Chat::Direct(peer.into());
        forged.authority_context.chat_key = format!("direct:{}:{}", pair[0], pair[1]);
        forged.authority.clear();
        assert_eq!(
            resolve_current_route(&registry, &keys, &scoped_identity_key, user_index, &forged).unwrap_err(),
            "direct confirmed actions require a current per-user-key app"
        );
    }
}
