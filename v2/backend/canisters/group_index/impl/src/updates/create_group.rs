use crate::{RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MIN_CYCLES_BALANCE, RUNTIME_STATE};
use candid::{CandidType, Principal};
use group_index_canister::updates::create_group::{Response::*, *};
use ic_cdk_macros::update;
use shared::canisters;
use shared::consts::CREATE_CANISTER_CYCLES_FEE;
use types::{CanisterWasm, GroupChatId, UserId, Version};

#[update]
async fn create_group(args: Args) -> Response {
    let canister_args = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow_mut().as_mut().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_arg = candid::encode_one(canister_args.init_canister_args).unwrap();
    match canisters::create::call(
        None,
        canister_args.canister_wasm.module,
        wasm_arg,
        canister_args.cycles_to_use,
    )
    .await
    {
        Ok(canister_id) => {
            let group_id = canister_id.into();
            let wasm_version = canister_args.canister_wasm.version;
            RUNTIME_STATE.with(|state| {
                commit(
                    args.is_public,
                    group_id,
                    args.name,
                    wasm_version,
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Success(SuccessResult { group_id })
        }
        Err(_) => {
            // TODO handle case where canister was created but installation failed
            RUNTIME_STATE.with(|state| rollback(args.is_public, &args.name, state.borrow_mut().as_mut().unwrap()));
            InternalError
        }
    }
}

struct CreateCanisterArgs {
    canister_wasm: CanisterWasm,
    cycles_to_use: u64,
    init_canister_args: InitGroupCanisterArgs,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<CreateCanisterArgs, Response> {
    let cycles_required = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
    let current_cycles_balance = ic_cdk::api::canister_balance();
    if current_cycles_balance.saturating_sub(cycles_required) < MIN_CYCLES_BALANCE {
        return Err(CyclesBalanceTooLow);
    }

    let now = runtime_state.env.now();
    let user_id = runtime_state.env.caller().into();

    if args.is_public && !runtime_state.data.public_groups.reserve_name(args.name.clone(), now) {
        Err(NameTaken)
    } else {
        let canister_wasm = runtime_state.data.group_canister_wasm.clone();
        let init_canister_args = InitGroupCanisterArgs {
            is_public: args.is_public,
            name: args.name.clone(),
            created_by_principal: args.creator_principal,
            created_by_user_id: user_id,
            wasm_version: canister_wasm.version.clone(),
        };

        Ok(CreateCanisterArgs {
            canister_wasm,
            cycles_to_use: cycles_required,
            init_canister_args,
        })
    }
}

fn commit(is_public: bool, group_id: GroupChatId, name: String, wasm_version: Version, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    if is_public {
        runtime_state
            .data
            .public_groups
            .handle_group_created(group_id, name, now, wasm_version);
    } else {
        runtime_state
            .data
            .private_groups
            .handle_group_created(group_id, now, wasm_version);
    }
}

fn rollback(is_public: bool, name: &str, runtime_state: &mut RuntimeState) {
    if is_public {
        runtime_state.data.public_groups.handle_group_creation_failed(name);
    }
}

#[derive(CandidType)]
struct InitGroupCanisterArgs {
    is_public: bool,
    name: String,
    created_by_principal: Principal,
    created_by_user_id: UserId,
    wasm_version: Version,
}
