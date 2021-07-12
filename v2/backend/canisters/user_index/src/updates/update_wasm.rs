use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    user_wasm_module: Vec<u8>,
    version: String,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    NotAuthorized,
    InvalidVersion,
    ExistingWasmHasHigherVersion,
}

#[update]
fn update_wasm(args: Args) -> Response {
    RUNTIME_STATE.with(|state| update_wasm_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn update_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let permitted_callers = &runtime_state.data.service_principals;

    if !permitted_callers.contains(&caller) {
        return Response::NotAuthorized;
    }

    match semver::Version::parse(&args.version) {
        Err(_) => Response::InvalidVersion,
        Ok(new_version) => {
            if new_version <= runtime_state.data.user_wasm.version {
                Response::ExistingWasmHasHigherVersion
            } else {
                runtime_state.data.user_wasm.version = new_version;
                runtime_state.data.user_wasm.module = args.user_wasm_module;
                Response::Success
            }
        }
    }
}
