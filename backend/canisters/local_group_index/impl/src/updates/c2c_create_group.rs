use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MARK_ACTIVE_DURATION};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use group_canister::init::Args as InitGroupCanisterArgs;
use local_group_index_canister::c2c_create_group::{Response::*, *};
use types::{BuildVersion, CanisterId, CanisterWasm, ChatId, Cycles, GroupCreatedEventPayload, UserId, UserType};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{min_cycles_balance, CREATE_CANISTER_CYCLES_FEE};

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
async fn c2c_create_group(args: Args) -> Response {
    let prepare_ok = match mutate_state(|state| prepare(args, state)) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    let created_by = prepare_ok.init_canister_args.created_by_user_id;
    let is_public = prepare_ok.init_canister_args.is_public;
    let gate_type = prepare_ok.init_canister_args.gate.as_ref().map(|g| g.gate_type().to_string());
    let rules_enabled = prepare_ok.init_canister_args.rules.enabled;
    let wasm_version = prepare_ok.canister_wasm.version;

    match canister::create_and_install(
        prepare_ok.canister_id,
        prepare_ok.canister_wasm,
        prepare_ok.init_canister_args,
        prepare_ok.cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let chat_id = canister_id.into();
            mutate_state(|state| {
                commit(
                    chat_id,
                    created_by,
                    GroupCreatedEventPayload {
                        public: is_public,
                        gate: gate_type,
                        rules_enabled,
                    },
                    wasm_version,
                    state,
                )
            });
            Success(SuccessResult {
                chat_id,
                local_user_index_canister_id: prepare_ok.local_user_index_canister_id,
            })
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateAndInstallError::InstallFailed(id, ..) = error {
                canister_id = Some(id);
            }
            mutate_state(|state| rollback(canister_id, state));
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareOk {
    canister_id: Option<CanisterId>,
    local_user_index_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: InitGroupCanisterArgs,
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let cycles_to_use = if state.data.canister_pool.is_empty() {
        let cycles_required = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, min_cycles_balance(state.data.test_mode)) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let canister_wasm = state.data.group_canister_wasm_for_new_canisters.wasm.clone();
    let local_user_index_canister_id = state.data.local_user_index_canister_id;
    let init_canister_args = group_canister::init::Args {
        is_public: args.is_public,
        name: args.name,
        description: args.description,
        rules: args.rules,
        subtype: args.subtype,
        // History is always visible on public groups
        history_visible_to_new_joiners: args.is_public || args.history_visible_to_new_joiners,
        messages_visible_to_non_members: args.messages_visible_to_non_members,
        permissions_v2: args.permissions_v2,
        created_by_principal: args.created_by_user_principal,
        created_by_user_id: args.created_by_user_id,
        created_by_user_type: if args.created_by_user_id == state.data.proposals_bot_user_id {
            UserType::OcControlledBot
        } else {
            UserType::User
        },
        events_ttl: args.events_ttl,
        mark_active_duration: MARK_ACTIVE_DURATION,
        group_index_canister_id: state.data.group_index_canister_id,
        local_group_index_canister_id: state.env.canister_id(),
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id,
        notifications_canister_id: state.data.notifications_canister_id,
        proposals_bot_user_id: state.data.proposals_bot_user_id,
        escrow_canister_id: state.data.escrow_canister_id,
        internet_identity_canister_id: state.data.internet_identity_canister_id,
        avatar: args.avatar,
        gate: args.gate,
        video_call_operators: state.data.video_call_operators.clone(),
        ic_root_key: state.data.ic_root_key.clone(),
        wasm_version: canister_wasm.version,
        test_mode: state.data.test_mode,
    };

    Ok(PrepareOk {
        canister_id,
        local_user_index_canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(
    chat_id: ChatId,
    created_by: UserId,
    event_payload: GroupCreatedEventPayload,
    wasm_version: BuildVersion,
    state: &mut RuntimeState,
) {
    state.data.local_groups.add(chat_id, wasm_version);

    state.data.event_store_client.push(
        EventBuilder::new("group_created", state.env.now())
            .with_user(created_by.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&event_payload)
            .build(),
    );
}

fn rollback(canister_id: Option<CanisterId>, state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
