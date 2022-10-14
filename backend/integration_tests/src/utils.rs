use candid::Principal;

pub fn principal_to_username(principal: Principal) -> String {
    principal.to_string()[0..5].to_string()
}
