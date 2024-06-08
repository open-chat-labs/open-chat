use crate::{generate_query_call, generate_update_call};

// Queries
generate_query_call!(get_delegation);

// Updates
generate_update_call!(generate_magic_link);
generate_update_call!(handle_magic_link);

mod generate_magic_link {
    pub type Args = sign_in_with_email_canister::GenerateMagicLinkArgs;
    pub type Response = sign_in_with_email_canister::GenerateMagicLinkResponse;
}

mod get_delegation {
    pub type Args = sign_in_with_email_canister::GetDelegationArgs;
    pub type Response = sign_in_with_email_canister::GetDelegationResponse;
}

mod handle_magic_link {
    pub type Args = sign_in_with_email_canister::HandleMagicLinkArgs;
    pub type Response = sign_in_with_email_canister::HandleMagicLinkResponse;
}
