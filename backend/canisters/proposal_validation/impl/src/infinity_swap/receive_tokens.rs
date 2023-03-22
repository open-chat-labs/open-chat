use candid::Principal;
use ic_cdk_macros::query;

#[query]
fn infinity_swap_receive_tokens_validate(principal: Principal) -> Result<String, String> {
    Ok(principal.to_string())
}
