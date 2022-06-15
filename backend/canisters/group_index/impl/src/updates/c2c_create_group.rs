use crate::model::public_groups::GroupCreatedArgs;
use crate::{mutate_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MARK_ACTIVE_DURATION, MIN_CYCLES_BALANCE};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group::{Response::*, *};
use types::{Avatar, CanisterId, CanisterWasm, ChatId, Cycles, Version};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

#[update_msgpack]
#[trace]
async fn c2c_create_group(args: Args) -> Response {
    let name = args.name.to_owned();
    let description = args.description.to_owned();
    let is_public = args.is_public;
    let avatar_id = Avatar::id(&args.avatar);

    let canister_args = match mutate_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_arg = candid::encode_one(canister_args.init_canister_args).unwrap();
    let cycles_to_use = canister_args.cycles_to_use;
    match canister::create_and_install(
        canister_args.canister_id,
        canister_args.canister_wasm.module,
        wasm_arg,
        cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let chat_id = canister_id.into();
            let wasm_version = canister_args.canister_wasm.version;
            mutate_state(|state| {
                commit(
                    CommitArgs {
                        is_public,
                        chat_id,
                        name,
                        description,
                        avatar_id,
                        wasm_version,
                    },
                    state,
                )
            });
            Success(SuccessResult { chat_id })
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateAndInstallError::InstallFailed((_, id)) = error {
                canister_id = Some(id);
            }

            mutate_state(|state| rollback(is_public, &name, canister_id, state));
            InternalError
        }
    }
}

struct CreateCanisterArgs {
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: group_canister::init::Args,
}

fn prepare(args: Args, runtime_state: &mut RuntimeState) -> Result<CreateCanisterArgs, Response> {
    let cycles_to_use = if runtime_state.data.canister_pool.is_empty() {
        let cycles_required = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let now = runtime_state.env.now();
    let user_id = runtime_state.env.caller().into();

    if args.is_public && !runtime_state.data.public_groups.reserve_name(&args.name, now) {
        Err(NameTaken)
    } else {
        let canister_id = runtime_state.data.canister_pool.pop();
        let canister_wasm = runtime_state.data.group_canister_wasm.clone();
        let init_canister_args = group_canister::init::Args {
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            // History is always visible on public groups
            history_visible_to_new_joiners: args.is_public || args.history_visible_to_new_joiners,
            permissions: args.permissions,
            created_by_principal: args.creator_principal,
            created_by_user_id: user_id,
            mark_active_duration: MARK_ACTIVE_DURATION,
            wasm_version: canister_wasm.version,
            user_index_canister_id: runtime_state.data.user_index_canister_id,
            notifications_canister_ids: runtime_state.data.notifications_canister_ids.clone(),
            callback_canister_id: runtime_state.data.callback_canister_id,
            avatar: args.avatar,
            test_mode: runtime_state.data.test_mode,
        };

        Ok(CreateCanisterArgs {
            canister_id,
            canister_wasm,
            cycles_to_use,
            init_canister_args,
        })
    }
}

struct CommitArgs {
    is_public: bool,
    chat_id: ChatId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
    wasm_version: Version,
}

fn commit(args: CommitArgs, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    if args.is_public {
        runtime_state.data.public_groups.handle_group_created(GroupCreatedArgs {
            chat_id: args.chat_id,
            name: args.name,
            description: args.description,
            avatar_id: args.avatar_id,
            now,
            wasm_version: args.wasm_version,
            cycles: GROUP_CANISTER_INITIAL_CYCLES_BALANCE,
        });
    } else {
        runtime_state.data.private_groups.handle_group_created(
            args.chat_id,
            now,
            args.wasm_version,
            GROUP_CANISTER_INITIAL_CYCLES_BALANCE,
        );
    }
}

fn rollback(is_public: bool, name: &str, canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
    if is_public {
        runtime_state.data.public_groups.handle_group_creation_failed(name);
    }

    if let Some(canister_id) = canister_id {
        runtime_state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
