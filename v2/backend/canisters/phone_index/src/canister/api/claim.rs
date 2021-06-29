use candid::{CandidType, Principal};
use crate::canister::RUNTIME_STATE;
use crate::domain::phone_index::{ClaimRequest, ClaimResult};
use crate::user_index_canister_client::{CreateUserRequest, CreateUserResponse};
use ic_cdk_macros::update;
use serde::Deserialize;

#[update]
pub async fn claim(request: Request) -> Response {
    let (caller, now, user_index_canister_client) = RUNTIME_STATE.with(|state| {
        state.borrow().as_ref().map(|s| (s.env.caller(), s.env.now(), s.user_index_canister_client)).unwrap()
    });

    let claim_request = ClaimRequest {
        caller, 
        confirmation_code: request.confirmation_code, 
        now
    };

    let claim_result = RUNTIME_STATE.with(|state| {
        state.borrow_mut().as_mut().unwrap().phone_index.claim(claim_request)
    });

    match claim_result {
        ClaimResult::Success(phone_number) => {
            let create_user_request = CreateUserRequest::new(caller, phone_number);

            match user_index_canister_client.create(create_user_request).await {
                Ok(result) => {
                    match result {
                        CreateUserResponse::Success(r) => Response::Success(SuccessResult { canister_id: r.get_canister_id() }),
                        CreateUserResponse::UserExists => Response::AlreadyClaimed,
                        CreateUserResponse::UserLimitReached => Response::UserLimitReached
                    }
                },
                Err(error) => {
                    Response::FailedToCreateUserCanister(error)
                }
            }
        },
        ClaimResult::ConfirmationCodeIncorrect => Response::ConfirmationCodeIncorrect,
        ClaimResult::ConfirmationCodeExpired => Response::ConfirmationCodeExpired,
        ClaimResult::AlreadyClaimed => Response::AlreadyClaimed,
        ClaimResult::NotFound => Response::NotFound,
    }
}

#[derive(Deserialize)]
pub struct Request {
    confirmation_code: String
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    NotFound,
    UserLimitReached,
    FailedToCreateUserCanister(String),
}

#[derive(CandidType)]
pub struct SuccessResult {
    canister_id: Principal,
}