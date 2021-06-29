use candid::Principal;
use phonenumber::PhoneNumber;
use ic_cdk::export::candid::{Deserialize, CandidType};
use ic_cdk::api::call::CallResult;

#[derive(Copy, Clone)]
pub struct UserIndexCanisterClient {
    canister_id: Principal,
}

impl UserIndexCanisterClient {
    pub fn new(canister_id: Principal) -> UserIndexCanisterClient {
        UserIndexCanisterClient {
            canister_id
        }
    }

    pub async fn create(&self, request: CreateUserRequest) -> Result<CreateUserResponse, String> {
        let response: CallResult<(CreateUserResponse, )> = ic_cdk::call(self.canister_id, "create", (request,)).await;
        response.map_err(|e| e.1).map(|r| r.0)
    }
}

#[derive(CandidType)]
pub struct CreateUserRequest {
    user_principal: Principal,
    phone_number: String,
}

impl CreateUserRequest {
    pub fn new(user_principal: Principal, phone_number: PhoneNumber) -> CreateUserRequest {
        CreateUserRequest {
            user_principal,
            phone_number: phone_number.to_string()
        }
    }
}

#[derive(Deserialize)]
pub enum CreateUserResponse {
    Success(SuccessResult),
    UserExists,
    UserLimitReached
}

#[derive(Deserialize)]
pub struct SuccessResult {
    canister_id: Principal
}

impl SuccessResult {
    pub fn get_canister_id(&self) -> Principal {
        self.canister_id
    }
}
