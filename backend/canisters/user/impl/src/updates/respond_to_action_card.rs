use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use chat_events::RespondToActionCardArgs;
use local_user_index_canister::c2c_deposit_action_confirmed::ActionDepositContext;
use oc_error_codes::{OCError, OCErrorCode};
use serde_bytes::ByteBuf;
use types::{ActionCardResponse, ActionCardState, CanisterId, Chat, EventIndex, OCResult, TimestampMillis, UserId, UserType};
use user_canister::respond_to_action_card::{Response::*, *};
use user_canister::{ActionCardStatusChange, UserCanisterEvent};

fn requested_confirm_payload_hash(args: &Args, edited_confirmation_enabled: bool) -> OCResult<Option<[u8; 32]>> {
    match (&args.confirm_payload_override, &args.confirmation_grant) {
        (None, None) => Ok(None),
        (Some(payload), Some(grant)) if edited_confirmation_enabled => {
            if payload.is_empty()
                || payload.len() > types::MAX_AI_APP_CONFIRM_PAYLOAD_BYTES
                || grant.len() != types::AI_APP_CARD_TOKEN_BYTES
            {
                return Err(OCErrorCode::InvalidRequest.with_message("invalid edited confirmation payload or grant"));
            }
            types::ai_app_card_confirm_payload_hash_v1(payload)
                .map(Some)
                .map_err(|error| OCErrorCode::InvalidRequest.with_message(error))
        }
        (Some(_), Some(_)) => Err(OCErrorCode::InvalidRequest.with_message("edited card confirmation is not enabled")),
        _ => Err(OCErrorCode::InvalidRequest
            .with_message("confirm_payload_override and confirmation_grant must be supplied together")),
    }
}

#[derive(Debug, Eq, PartialEq)]
enum ConfirmationGrantPlan {
    StoredPayload,
    Consume([u8; 32]),
    Reuse([u8; 32]),
    Reject,
}

fn confirmation_grant_plan(existing: Option<[u8; 32]>, supplied: Option<&ByteBuf>) -> ConfirmationGrantPlan {
    match (existing, supplied) {
        (None, None) => ConfirmationGrantPlan::StoredPayload,
        (None, Some(grant)) => ConfirmationGrantPlan::Consume(chat_events::ai_app_card_confirmation_grant_hash_v1(grant)),
        (Some(existing), Some(grant)) => {
            let supplied = chat_events::ai_app_card_confirmation_grant_hash_v1(grant);
            if existing == supplied {
                ConfirmationGrantPlan::Reuse(supplied)
            } else {
                ConfirmationGrantPlan::Reject
            }
        }
        // Once an edited-confirmation grant is persisted, omitting it must never fall through to
        // the original stored-payload path, even if both payload hashes happen to be identical.
        (Some(_), None) => ConfirmationGrantPlan::Reject,
    }
}

fn confirmation_grant_consumption_error(
    result: Result<local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response, types::C2CError>,
) -> Option<OCError> {
    match result {
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::Success) => None,
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::NotFound) => {
            Some(OCErrorCode::InvalidRequest.with_message("confirmation grant was not found"))
        }
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::Expired) => {
            Some(OCErrorCode::InvalidRequest.with_message("confirmation grant expired"))
        }
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::AppUnavailable) => {
            Some(OCErrorCode::InvalidRequest.with_message("AI app is unavailable"))
        }
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::InvalidRequest(error)) => {
            Some(OCErrorCode::InvalidRequest.with_message(error))
        }
        Ok(local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Response::Error(_)) | Err(_) => {
            Some(OCErrorCode::C2CError.with_message("confirmation grant service unavailable"))
        }
    }
}

// Deposit first and commit/mirror only after the inbox acknowledges the exact payload-bound
// delivery. Ambiguous deposit outcomes deliberately retain the lease for idempotent reconciliation.
#[update(guard = "caller_is_owner", msgpack = true)]
async fn respond_to_action_card(args: Args) -> Response {
    let (user_id, deposit) = match execute_update(|state| prepare(&args, state)) {
        Ok(Prepared::Committed(state)) => return Success(state),
        Ok(Prepared::NeedsDeposit { user_id, deposit }) => (user_id, deposit),
        Err(error) => return Error(error),
    };

    if let Err(error) = execute_update(|state| revalidate_before_deposit(user_id, &deposit, state)) {
        // `reserve_action_card_confirm` may have returned a lease created by an already-awaited
        // sibling request. Without a proven newly-created lease this callback must never release it.
        return Error(error);
    }

    match confirmation_grant_plan(deposit.confirmation_grant_hash, deposit.confirmation_grant.as_ref()) {
        ConfirmationGrantPlan::StoredPayload => {}
        ConfirmationGrantPlan::Reject => {
            return Error(OCErrorCode::InvalidRequest.with_message("confirmation grant does not match the durable lease"));
        }
        ConfirmationGrantPlan::Consume(grant_hash) => {
            let grant = deposit
                .confirmation_grant
                .clone()
                .expect("the grant planner requires a bearer for consumption");
            let result = local_user_index_canister_c2c_client::c2c_consume_ai_app_card_confirmation_grant(
                deposit.local_user_index_canister_id,
                &local_user_index_canister::c2c_consume_ai_app_card_confirmation_grant::Args {
                    user_id,
                    chat: deposit.context.chat,
                    thread_root_message_index: deposit.context.thread_root_message_index,
                    message_id: deposit.context.message_id,
                    app_id: deposit.context.app_id.expect("verified app deposit must have an app id"),
                    app_revision: deposit
                        .context
                        .app_revision
                        .expect("verified app deposit must have a revision"),
                    action_id: deposit.context.action_id.clone(),
                    content_hash: deposit
                        .context
                        .content_hash
                        .expect("verified app deposit must have a content hash"),
                    member_user_ids: deposit.context.member_user_ids.clone(),
                    confirm_payload_hash: deposit.confirm_payload_hash,
                    grant,
                    confirmation_lease_generation: deposit.context.confirmation_lease_generation,
                    // Direct User children are authenticated by their exact LUI registration and
                    // current home route; GroupIndex authority is invalid for this path.
                    authority: ByteBuf::new(),
                },
            )
            .await;
            if let Some(error) = confirmation_grant_consumption_error(result) {
                // Another exact retry may have consumed the same one-use grant and still be waiting
                // to persist its marker. Re-read durable state, but never release the lease from a
                // post-await consume failure: doing so could erase that sibling's in-flight attempt.
                if execute_update(|state| require_consumed_grant(user_id, &deposit, grant_hash, state)).is_err() {
                    return Error(error);
                }
            } else if let Err(error) = execute_update(|state| persist_consumed_grant(user_id, &deposit, grant_hash, state)) {
                // The grant is already one-use-consumed. Preserve the exact lease on every failure,
                // including a conflicting marker, so no ambiguous delivery can be rebound.
                return Error(error);
            }
        }
        ConfirmationGrantPlan::Reuse(grant_hash) => {
            if let Err(error) = execute_update(|state| require_consumed_grant(user_id, &deposit, grant_hash, state)) {
                // A retry fast path is valid only while the exact durable marker still exists.
                return Error(error);
            }
        }
    }

    match local_user_index_canister_c2c_client::c2c_deposit_action_confirmed(
        deposit.local_user_index_canister_id,
        &local_user_index_canister::c2c_deposit_action_confirmed::Args {
            consumer_public_key_pem: String::new(),
            consumer_public_key_pems: Vec::new(),
            plaintext: deposit.confirm_payload.clone(),
            created_at: deposit.created_at,
            inbox_canister_id: None,
            context: deposit.context.clone(),
            authority: ByteBuf::new(),
        },
    )
    .await
    {
        Ok(local_user_index_canister::c2c_deposit_action_confirmed::Response::Success) => {}
        Ok(local_user_index_canister::c2c_deposit_action_confirmed::Response::OutcomeUnknown) | Err(_) => {
            // The inbox may have committed. Keep the exact lease so a retry reconciles the same
            // full-width ActionInbox commitment instead of creating a second delivery.
            return Error(OCErrorCode::C2CError.with_message("action deposit outcome is pending reconciliation"));
        }
        Ok(local_user_index_canister::c2c_deposit_action_confirmed::Response::NotConfigured) => {
            // A sibling request for this same generation and payload may already be awaiting its
            // own deposit response. Even an individually definite failure cannot safely release a
            // shared lease after an await; keep it retryable as the same immutable attempt.
            return Error(OCErrorCode::InvalidRequest.with_message("the card's producing app is not configured"));
        }
        Ok(local_user_index_canister::c2c_deposit_action_confirmed::Response::Error(_)) => {
            return Error(OCErrorCode::C2CError.with_message("action deposit was rejected"));
        }
    }

    match execute_update(|state| complete_response(&deposit, state)) {
        Ok(state) => Success(state),
        Err(error) => Error(error),
    }
}

enum Prepared {
    Committed(ActionCardState),
    NeedsDeposit {
        user_id: UserId,
        deposit: Box<DepositInstruction>,
    },
}

struct DepositInstruction {
    ingress_owner: candid::Principal,
    local_user_index_canister_id: CanisterId,
    confirm_payload: ByteBuf,
    confirm_payload_hash: [u8; 32],
    confirmation_grant: Option<ByteBuf>,
    confirmation_grant_hash: Option<[u8; 32]>,
    created_at: TimestampMillis,
    context: ActionDepositContext,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<Prepared> {
    state.data.verify_not_suspended()?;
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    if !matches!(args.response, ActionCardResponse::Confirm)
        && (args.confirm_payload_override.is_some() || args.confirmation_grant.is_some())
    {
        return Err(OCErrorCode::InvalidRequest.with_message("cancel cannot carry a confirmation payload or grant"));
    }
    let requested_payload_hash = requested_confirm_payload_hash(args, state.data.test_mode)?;

    if matches!(args.response, ActionCardResponse::Confirm) {
        let other_user_id = args.user_id;
        if other_user_id == my_user_id || state.data.blocked_users.contains(&other_user_id) {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("AI-app cards require a distinct unblocked peer"));
        }
        let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) else {
            return Err(OCErrorCode::ChatNotFound.into());
        };
        if chat.user_type != UserType::User {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("AI-app cards require a human direct chat"));
        }
        let reserved = chat.events.reserve_action_card_confirm(
            args.thread_root_message_index,
            args.message_id,
            EventIndex::default(),
            my_user_id,
            requested_payload_hash,
            now,
        )?;
        if let Some(deposit) = reserved {
            let (confirm_payload, confirmation_grant) = match (&args.confirm_payload_override, &args.confirmation_grant) {
                (None, None) => (deposit.confirm_payload, None),
                (Some(payload), Some(grant)) => (payload.clone(), Some(grant.clone())),
                _ => unreachable!("both-or-neither was validated before reservation"),
            };
            return Ok(Prepared::NeedsDeposit {
                user_id: my_user_id,
                deposit: Box::new(DepositInstruction {
                    ingress_owner: state.data.owner,
                    local_user_index_canister_id: state.data.local_user_index_canister_id,
                    confirm_payload,
                    confirm_payload_hash: deposit.confirm_payload_hash,
                    confirmation_grant,
                    confirmation_grant_hash: deposit.confirmation_grant_hash,
                    created_at: deposit.responded_at,
                    context: ActionDepositContext {
                        chat: Chat::Direct(other_user_id.into()),
                        message_id: deposit.message_id,
                        thread_root_message_index: deposit.thread_root_message_index,
                        confirmed_by: deposit.confirmed_by,
                        app_id: deposit.app_id,
                        app_revision: deposit.app_revision,
                        app_verified: deposit.app_verified,
                        content_hash: deposit.content_hash,
                        confirmation_lease_generation: deposit.confirmation_lease_generation,
                        action_id: deposit.action_id,
                        member_user_ids: vec![my_user_id, other_user_id],
                    },
                }),
            });
        }
        if requested_payload_hash.is_some() {
            return Err(OCErrorCode::InvalidRequest.with_message("edited confirmation requires a deposit-bearing app card"));
        }
    }

    commit_response(args, state).map(Prepared::Committed)
}

fn revalidate_before_deposit(user_id: UserId, deposit: &DepositInstruction, state: &RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;
    if deposit.confirmation_grant.is_some() && !state.data.test_mode {
        return Err(OCErrorCode::InvalidRequest.with_message("edited card confirmation is not enabled"));
    }
    let current_user_id: UserId = state.env.canister_id().into();
    let Chat::Direct(other) = deposit.context.chat else {
        return Err(OCErrorCode::InvalidRequest.with_message("direct-card identity changed before delivery"));
    };
    let other_user_id: UserId = other.into();
    if state.data.owner != deposit.ingress_owner
        || current_user_id != user_id
        || deposit.context.confirmed_by != user_id
        || other_user_id == user_id
        || state.data.local_user_index_canister_id != deposit.local_user_index_canister_id
        || deposit.context.member_user_ids != [user_id, other_user_id]
        || state.data.blocked_users.contains(&other_user_id)
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("direct-card route changed before delivery"));
    }
    let chat = state
        .data
        .direct_chats
        .get(&other_user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    if chat.user_type != UserType::User {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("AI-app cards require a human direct chat"));
    }
    let source = chat.events.ai_app_card_confirmation_reservation_source(
        deposit.context.thread_root_message_index,
        deposit.context.message_id,
        EventIndex::default(),
        user_id,
        deposit.context.confirmation_lease_generation,
        deposit.confirm_payload_hash,
        state.env.now(),
    )?;
    if !deposit.context.app_verified
        || Some(source.app_id) != deposit.context.app_id
        || Some(source.app_revision) != deposit.context.app_revision
        || source.action_id != deposit.context.action_id
        || Some(source.content_hash) != deposit.context.content_hash
        || !types::ai_app_card_confirm_payload_hash_v1(&deposit.confirm_payload)
            .is_ok_and(|hash| hash == deposit.confirm_payload_hash)
    {
        return Err(OCErrorCode::InvalidRequest.with_message("card authorization changed before delivery"));
    }
    Ok(())
}

fn current_confirmation_grant_hash(
    user_id: UserId,
    deposit: &DepositInstruction,
    state: &RuntimeState,
) -> OCResult<Option<[u8; 32]>> {
    let Chat::Direct(other) = deposit.context.chat else {
        return Err(OCErrorCode::InvalidRequest.with_message("direct-card identity changed before delivery"));
    };
    let other_user_id: UserId = other.into();
    let chat = state
        .data
        .direct_chats
        .get(&other_user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    chat.events.action_card_confirmation_grant_hash_for_lease(
        deposit.context.thread_root_message_index,
        deposit.context.message_id,
        EventIndex::default(),
        user_id,
        deposit.context.confirmation_lease_generation,
        deposit.confirm_payload_hash,
        state.env.now(),
    )
}

fn consumed_grant_is_persisted(
    user_id: UserId,
    deposit: &DepositInstruction,
    grant_hash: [u8; 32],
    state: &RuntimeState,
) -> OCResult<bool> {
    current_confirmation_grant_hash(user_id, deposit, state).map(|stored| stored == Some(grant_hash))
}

fn require_consumed_grant(
    user_id: UserId,
    deposit: &DepositInstruction,
    grant_hash: [u8; 32],
    state: &RuntimeState,
) -> OCResult {
    if consumed_grant_is_persisted(user_id, deposit, grant_hash, state)? {
        // Read the durable marker first. Mutable policy changes after UserIndex spent the bearer
        // must not prevent recording it, but they still fail closed before any inbox deposit.
        revalidate_before_deposit(user_id, deposit, state)
    } else {
        Err(OCErrorCode::InvalidRequest.with_message("confirmation grant does not match the durable lease"))
    }
}

fn persist_consumed_grant(
    user_id: UserId,
    deposit: &DepositInstruction,
    grant_hash: [u8; 32],
    state: &mut RuntimeState,
) -> OCResult {
    let Chat::Direct(other) = deposit.context.chat else {
        return Err(OCErrorCode::InvalidRequest.with_message("direct-card identity changed before delivery"));
    };
    let other_user_id: UserId = other.into();
    let now = state.env.now();
    let chat = state
        .data
        .direct_chats
        .get_mut(&other_user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    chat.events.mark_action_card_confirmation_grant_consumed(
        deposit.context.thread_root_message_index,
        deposit.context.message_id,
        EventIndex::default(),
        user_id,
        deposit.context.confirmation_lease_generation,
        deposit.confirm_payload_hash,
        grant_hash,
        now,
    )?;
    // Re-read the complete route, source, lease and marker after the trusted mutation. No deposit
    // begins unless the exact authorization still exists in current durable state.
    require_consumed_grant(user_id, deposit, grant_hash, state)
}

fn commit_response(args: &Args, state: &mut RuntimeState) -> OCResult<ActionCardState> {
    state.data.verify_not_suspended()?;
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };
    let result = chat.events.respond_to_action_card(RespondToActionCardArgs {
        user_id: my_user_id,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        response: args.response,
        now,
    })?;
    let thread_root_message_id = args
        .thread_root_message_index
        .map(|index| chat.main_message_index_to_id(index));
    state.push_user_canister_event(
        args.user_id.canister_id(),
        UserCanisterEvent::ActionCardStatusChange(Box::new(ActionCardStatusChange {
            thread_root_message_id,
            message_id: args.message_id,
            state: result.value.state.clone(),
            responded_by: my_user_id,
            responded_at: now,
        })),
    );
    Ok(result.value.state)
}

fn complete_response(deposit: &DepositInstruction, state: &mut RuntimeState) -> OCResult<ActionCardState> {
    let my_user_id: UserId = state.env.canister_id().into();
    let Chat::Direct(other) = deposit.context.chat else {
        return Err(OCErrorCode::InvalidRequest.with_message("direct-card identity changed before completion"));
    };
    let other_user_id: UserId = other.into();
    if my_user_id != deposit.context.confirmed_by || other_user_id == my_user_id {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let now = state.env.now();
    let Some(chat) = state.data.direct_chats.get_mut(&other_user_id.into()) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };
    let result = chat.events.complete_action_card_confirm(
        deposit.context.thread_root_message_index,
        deposit.context.message_id,
        EventIndex::default(),
        my_user_id,
        deposit.context.confirmation_lease_generation,
        deposit.confirm_payload_hash,
        now,
    )?;
    let thread_root_message_id = deposit
        .context
        .thread_root_message_index
        .map(|index| chat.main_message_index_to_id(index));
    state.push_user_canister_event(
        other_user_id.canister_id(),
        UserCanisterEvent::ActionCardStatusChange(Box::new(ActionCardStatusChange {
            thread_root_message_id,
            message_id: deposit.context.message_id,
            state: result.value.state.clone(),
            responded_by: my_user_id,
            responded_at: now,
        })),
    );
    Ok(result.value.state)
}

#[cfg(test)]
mod tests {
    #[test]
    fn boxed_prepared_deposit_preserves_the_owned_instruction() {
        let user_id = candid::Principal::from_slice(&[1]).into();
        let canister_id = candid::Principal::from_slice(&[2]);
        let context = super::ActionDepositContext {
            chat: types::Chat::Direct(canister_id.into()),
            message_id: 3u64.into(),
            thread_root_message_index: Some(4u32.into()),
            confirmed_by: user_id,
            app_id: Some(5),
            app_revision: Some(6),
            app_verified: true,
            content_hash: Some([7; 32]),
            confirmation_lease_generation: 8,
            action_id: "sample.action".into(),
            member_user_ids: vec![user_id],
        };
        let expected_context = candid::encode_one(&context).unwrap();
        let instruction = Box::new(super::DepositInstruction {
            local_user_index_canister_id: canister_id,
            ingress_owner: canister_id,
            confirm_payload: ByteBuf::from(vec![0, 255, 9]),
            confirm_payload_hash: [10; 32],
            confirmation_grant: Some(ByteBuf::from(vec![11; types::AI_APP_CARD_TOKEN_BYTES])),
            confirmation_grant_hash: Some([12; 32]),
            created_at: 13,
            context,
        });
        let expected_address = (&*instruction) as *const super::DepositInstruction;
        let prepared = super::Prepared::NeedsDeposit {
            user_id,
            deposit: instruction,
        };
        let super::Prepared::NeedsDeposit {
            user_id: actual_user,
            deposit,
        } = prepared
        else {
            panic!("a required deposit must not become committed");
        };
        assert_eq!(actual_user, user_id);
        assert_eq!((&*deposit) as *const super::DepositInstruction, expected_address);
        assert_eq!(deposit.confirm_payload.as_slice(), &[0, 255, 9]);
        assert_eq!(deposit.confirm_payload_hash, [10; 32]);
        assert_eq!(
            deposit.confirmation_grant.unwrap().as_slice(),
            &[11; types::AI_APP_CARD_TOKEN_BYTES]
        );
        assert_eq!(deposit.confirmation_grant_hash, Some([12; 32]));
        assert_eq!(deposit.created_at, 13);
        assert_eq!(deposit.local_user_index_canister_id, canister_id);
        assert_eq!(deposit.ingress_owner, canister_id);
        assert_eq!(candid::encode_one(&deposit.context).unwrap(), expected_context);
    }

    #[test]
    fn status_events_address_the_host_canister_without_replacing_user_identity() {
        let source = include_str!("respond_to_action_card.rs").replace("\r\n", "\n");
        let production = source.split("#[cfg(test)]").next().unwrap();
        assert_eq!(production.matches("state.push_user_canister_event(").count(), 2);
        for user in ["args.user_id", "other_user_id"] {
            assert!(production.contains(&format!("state.push_user_canister_event(\n        {user}.canister_id(),")));
        }
        let host = candid::Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let first = types::UserId::new_indexed(host, 1);
        let second = types::UserId::new_indexed(host, 2);
        assert_eq!(first.canister_id(), second.canister_id());
        assert_ne!(first, second);
    }

    #[test]
    fn committed_action_short_circuits_before_any_deposit_work() {
        let source = include_str!("respond_to_action_card.rs");
        let handler_start = source.find("async fn respond_to_action_card").unwrap();
        let handler_end = handler_start + source[handler_start..].find("enum Prepared").unwrap();
        let handler = &source[handler_start..handler_end];
        assert!(handler.contains("Ok(Prepared::Committed(state)) => return Success(state)"));
        assert!(handler.find("Prepared::Committed").unwrap() < handler.find(".await").unwrap());
    }

    use super::{ConfirmationGrantPlan, confirmation_grant_plan, requested_confirm_payload_hash};
    use candid::Principal;
    use serde_bytes::ByteBuf;
    use types::{ActionCardResponse, MessageId};
    use user_canister::respond_to_action_card::Args;

    const HANDLER_SOURCE: &str = include_str!("respond_to_action_card.rs");

    fn args(payload: Option<ByteBuf>, grant: Option<ByteBuf>) -> Args {
        Args {
            user_id: Principal::from_slice(&[2]).into(),
            thread_root_message_index: None,
            message_id: MessageId::from(1u64),
            response: ActionCardResponse::Confirm,
            confirm_payload_override: payload,
            confirmation_grant: grant,
        }
    }

    fn grant() -> ByteBuf {
        ByteBuf::from(vec![7; types::AI_APP_CARD_TOKEN_BYTES])
    }

    #[test]
    fn stored_payload_confirmation_needs_no_grant_in_any_mode() {
        assert_eq!(requested_confirm_payload_hash(&args(None, None), false).unwrap(), None);
        assert_eq!(requested_confirm_payload_hash(&args(None, None), true).unwrap(), None);
    }

    #[test]
    fn edited_payload_and_grant_are_an_atomic_pair() {
        assert!(requested_confirm_payload_hash(&args(Some(ByteBuf::from(b"EDITED".to_vec())), None), true).is_err());
        assert!(requested_confirm_payload_hash(&args(None, Some(grant())), true).is_err());
    }

    #[test]
    fn edited_payload_is_hash_bound_in_test_mode() {
        let edited = ByteBuf::from(b"EDITED".to_vec());
        let expected = types::ai_app_card_confirm_payload_hash_v1(&edited).unwrap();
        assert_eq!(
            requested_confirm_payload_hash(&args(Some(edited), Some(grant())), true).unwrap(),
            Some(expected)
        );
    }

    #[test]
    fn production_gate_rejects_edited_confirmation() {
        assert!(requested_confirm_payload_hash(&args(Some(ByteBuf::from(b"EDITED".to_vec())), Some(grant())), false,).is_err());
    }

    #[test]
    fn edited_payload_and_grant_bounds_fail_closed() {
        assert!(requested_confirm_payload_hash(&args(Some(ByteBuf::new()), Some(grant())), true).is_err());
        assert!(
            requested_confirm_payload_hash(
                &args(
                    Some(ByteBuf::from(vec![1; types::MAX_AI_APP_CONFIRM_PAYLOAD_BYTES + 1])),
                    Some(grant()),
                ),
                true,
            )
            .is_err()
        );
        for size in [types::AI_APP_CARD_TOKEN_BYTES - 1, types::AI_APP_CARD_TOKEN_BYTES + 1] {
            assert!(
                requested_confirm_payload_hash(
                    &args(Some(ByteBuf::from(b"EDITED".to_vec())), Some(ByteBuf::from(vec![7; size]))),
                    true,
                )
                .is_err()
            );
        }
    }

    #[test]
    fn maximum_size_edited_payload_is_accepted() {
        let edited = ByteBuf::from(vec![b'x'; types::MAX_AI_APP_CONFIRM_PAYLOAD_BYTES]);
        let expected = types::ai_app_card_confirm_payload_hash_v1(&edited).unwrap();
        assert_eq!(
            requested_confirm_payload_hash(&args(Some(edited), Some(grant())), true).unwrap(),
            Some(expected)
        );
    }

    #[test]
    fn durable_grant_marker_controls_retry_without_rebinding() {
        let grant = grant();
        let grant_hash = chat_events::ai_app_card_confirmation_grant_hash_v1(&grant);
        let different = ByteBuf::from(vec![8; types::AI_APP_CARD_TOKEN_BYTES]);

        assert_eq!(confirmation_grant_plan(None, None), ConfirmationGrantPlan::StoredPayload);
        assert_eq!(
            confirmation_grant_plan(None, Some(&grant)),
            ConfirmationGrantPlan::Consume(grant_hash)
        );
        assert_eq!(
            confirmation_grant_plan(Some(grant_hash), Some(&grant)),
            ConfirmationGrantPlan::Reuse(grant_hash)
        );
        assert_eq!(
            confirmation_grant_plan(Some(grant_hash), Some(&different)),
            ConfirmationGrantPlan::Reject,
            "a different grant must be rejected before it is consumed"
        );
        assert_eq!(
            confirmation_grant_plan(Some(grant_hash), None),
            ConfirmationGrantPlan::Reject,
            "a persisted edited-confirmation marker cannot fall through to the stored-payload path"
        );
    }

    #[test]
    fn reused_lease_is_never_released_by_a_sibling_request() {
        let handler_start = HANDLER_SOURCE.find("async fn respond_to_action_card").unwrap();
        let handler_end = HANDLER_SOURCE[handler_start..].find("enum Prepared").unwrap() + handler_start;
        let handler = &HANDLER_SOURCE[handler_start..handler_end];
        let abort_call = ["abort_action_card_", "confirm"].concat();
        assert!(
            !handler.contains(&abort_call),
            "no branch after reservation may release a lease that could belong to an in-flight sibling"
        );

        let prepare_start = HANDLER_SOURCE.find("fn prepare(").unwrap();
        let reserve = HANDLER_SOURCE[prepare_start..].find("reserve_action_card_confirm(").unwrap() + prepare_start;
        let before_reserve = &HANDLER_SOURCE[prepare_start..reserve];
        assert!(before_reserve.contains("blocked_users.contains"));
        assert!(before_reserve.contains("chat.user_type != UserType::User"));
    }

    #[test]
    fn spent_grant_is_persisted_before_mutable_policy_revalidation() {
        let persist_start = HANDLER_SOURCE.find("fn persist_consumed_grant(").unwrap();
        let persist_end = HANDLER_SOURCE[persist_start..].find("fn commit_response(").unwrap() + persist_start;
        let persist = &HANDLER_SOURCE[persist_start..persist_end];
        let mark = persist.find("mark_action_card_confirmation_grant_consumed(").unwrap();
        let revalidate = persist[mark..].find("require_consumed_grant(").unwrap() + mark;
        assert!(mark < revalidate);
        assert!(
            !persist[..mark].contains("revalidate_before_deposit("),
            "a spent one-use bearer must be durably marked before mutable policy can fail"
        );

        let require_start = HANDLER_SOURCE.find("fn require_consumed_grant(").unwrap();
        let require_end = HANDLER_SOURCE[require_start..].find("fn persist_consumed_grant(").unwrap() + require_start;
        let require = &HANDLER_SOURCE[require_start..require_end];
        assert!(
            require.find("consumed_grant_is_persisted(").unwrap() < require.find("revalidate_before_deposit(").unwrap(),
            "retry authorization must prove the durable exact marker before mutable policy revalidation"
        );
    }
}
