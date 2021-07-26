use super::create_public_group::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::{CandidType, Principal};
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::canisters;
use shared::canisters::canister_wasm::CanisterWasm;
use shared::types::chat_id::GroupChatId;
use shared::types::{UserId, Version};

#[derive(Deserialize)]
struct Args {
    creator_principal: Principal,
    name: String,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NameTaken,
    InternalError,
}

#[derive(CandidType)]
struct SuccessResult {
    group_id: GroupChatId,
}

#[update]
async fn create_public_group(args: Args) -> Response {
    let canister_args = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow_mut().as_mut().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_arg = candid::encode_one(canister_args.init_canister_args).unwrap();
    match canisters::create::call(None, canister_args.canister_wasm.module, wasm_arg).await {
        Ok(canister_id) => {
            let group_id = canister_id.into();
            let wasm_version = canister_args.canister_wasm.version;
            RUNTIME_STATE.with(|state| commit(group_id, args.name, wasm_version, state.borrow_mut().as_mut().unwrap()));
            Success(SuccessResult { group_id })
        }
        Err(_) => {
            // TODO handle case where canister was created but installation failed
            RUNTIME_STATE.with(|state| rollback(&args.name, state.borrow_mut().as_mut().unwrap()));
            InternalError
        }
    }
}

struct CreateCanisterArgs {
    canister_wasm: CanisterWasm,
    init_canister_args: InitGroupCanisterArgs,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<CreateCanisterArgs, Response> {
    let now = runtime_state.env.now();
    let user_id = runtime_state.env.caller().into();

    if runtime_state.data.public_groups.reserve_name(args.name.clone(), now) {
        let canister_wasm = runtime_state.data.group_canister_wasm.clone();
        let init_canister_args = InitGroupCanisterArgs {
            is_public: true,
            name: args.name.clone(),
            created_by_principal: args.creator_principal,
            created_by_user_id: user_id,
            wasm_version: canister_wasm.version.clone(),
        };

        Ok(CreateCanisterArgs {
            canister_wasm,
            init_canister_args,
        })
    } else {
        Err(NameTaken)
    }
}

fn commit(group_id: GroupChatId, name: String, wasm_version: Version, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state
        .data
        .public_groups
        .handle_group_created(group_id, name, now, wasm_version);
}

fn rollback(name: &str, runtime_state: &mut RuntimeState) {
    runtime_state.data.public_groups.handle_group_creation_failed(name);
}

#[derive(CandidType)]
struct InitGroupCanisterArgs {
    is_public: bool,
    name: String,
    created_by_principal: Principal,
    created_by_user_id: UserId,
    wasm_version: Version,
}
