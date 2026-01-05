use crate::guards::caller_is_group_index;
use crate::{CHILD_CANISTER_INITIAL_CYCLES_BALANCE, MARK_ACTIVE_DURATION, RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::init::Args as InitCommunityCanisterArgs;
use constants::{CREATE_CANISTER_CYCLES_FEE, min_cycles_balance};
use event_store_producer::EventBuilder;
use local_user_index_canister::ChildCanisterType;
use local_user_index_canister::c2c_create_community::{Response::*, *};
use oc_error_codes::OCErrorCode;
use rand::{Rng, RngCore};
use types::{
    BuildVersion, CanisterId, CanisterWasm, ChannelId, CommunityCreatedEventPayload, CommunityId, Cycles, OCResult, UserId,
    UserType,
};
use utils::canister;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
async fn c2c_create_community(args: Args) -> Response {
    let prepare_ok = match mutate_state(|state| prepare(args, state)) {
        Err(error) => return Error(error),
        Ok(ok) => ok,
    };

    let created_by = prepare_ok.init_canister_args.created_by_user_id;
    let is_public = prepare_ok.init_canister_args.is_public;
    let gate_type = prepare_ok
        .init_canister_args
        .gate_config
        .as_ref()
        .map(|g| g.gate.gate_type().to_string());
    let rules_enabled = prepare_ok.init_canister_args.rules.enabled;
    let channel_count = prepare_ok.init_canister_args.channels.len() as u32;
    let wasm_version = prepare_ok.canister_wasm.version;

    match canister::create_and_install(
        prepare_ok.canister_id,
        None,
        prepare_ok.canister_wasm,
        msgpack::serialize_then_unwrap(&prepare_ok.init_canister_args),
        prepare_ok.cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let community_id = canister_id.into();
            mutate_state(|state| {
                commit(
                    community_id,
                    created_by,
                    CommunityCreatedEventPayload {
                        public: is_public,
                        gate: gate_type,
                        rules_enabled,
                        channels: channel_count,
                    },
                    wasm_version,
                    state,
                )
            });
            Success(SuccessResult {
                community_id,
                channels: prepare_ok.channels,
                local_user_index_canister_id: prepare_ok.local_user_index_canister_id,
            })
        }
        Err((canister_id, error)) => {
            mutate_state(|state| rollback(canister_id, state));
            Error(error.into())
        }
    }
}

struct PrepareOk {
    canister_id: Option<CanisterId>,
    channels: Vec<(ChannelId, String)>,
    local_user_index_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: InitCommunityCanisterArgs,
}

fn prepare(args: Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let cycles_to_use = if state.data.canister_pool.is_empty() {
        let cycles_required = CHILD_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, min_cycles_balance(state.data.test_mode)) {
            return Err(OCErrorCode::CyclesBalanceTooLow.into());
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let channels: Vec<_> = args
        .default_channels
        .iter()
        .map(|name| (ChannelId::from(state.env.rng().next_u32()), name.clone()))
        .collect();
    let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::Community).wasm.clone();
    let local_user_index_canister_id = state.env.canister_id();
    let init_canister_args = community_canister::init::Args {
        is_public: args.is_public,
        name: args.name,
        description: args.description,
        rules: args.rules,
        permissions: args.permissions.unwrap_or_default(),
        created_by_principal: args.created_by_user_principal,
        created_by_user_id: args.created_by_user_id,
        created_by_user_type: UserType::User,
        mark_active_duration: MARK_ACTIVE_DURATION,
        group_index_canister_id: state.data.group_index_canister_id,
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id,
        proposals_bot_user_id: state.data.proposals_bot_canister_id.into(),
        escrow_canister_id: state.data.escrow_canister_id,
        internet_identity_canister_id: state.data.internet_identity_canister_id,
        avatar: args.avatar,
        banner: args.banner,
        gate_config: args.gate_config,
        channels: channels.clone(),
        default_channel_rules: args.default_channel_rules,
        source_group: args.source_group,
        #[expect(deprecated)]
        ic_root_key: ic_cdk::api::root_key(),
        rng_seed: state.env.rng().r#gen(),
        wasm_version: canister_wasm.version,
        video_call_operators: state.data.video_call_operators.clone(),
        test_mode: state.data.test_mode,
        primary_language: args.primary_language,
    };

    Ok(PrepareOk {
        canister_id,
        channels,
        local_user_index_canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(
    community_id: CommunityId,
    created_by: UserId,
    event_payload: CommunityCreatedEventPayload,
    wasm_version: BuildVersion,
    state: &mut RuntimeState,
) {
    state.data.local_communities.add(community_id, wasm_version);

    state.data.event_store_client.push(
        EventBuilder::new("community_created", state.env.now())
            .with_user(created_by.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&event_payload)
            .build(),
    );

    crate::jobs::topup_canister_pool::start_job_if_required(state, None);
}

fn rollback(canister_id: Option<CanisterId>, state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
