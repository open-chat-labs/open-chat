use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{parse_macro_input, AttributeArgs, Meta, NestedMeta};

struct MethodAttribute {
    canister_name: String,
    method_name: String,
    method_type: String,
}

#[proc_macro]
pub fn generate_candid_method(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as AttributeArgs);
    let attribute = get_method_attribute(input);

    let canister_name = format_ident!("{}", attribute.canister_name);
    let method_name = format_ident!("{}", attribute.method_name);
    let method_type = format_ident!("{}", attribute.method_type);

    let args_name = quote! { #canister_name::#method_name::Args };
    let response_name = quote! { #canister_name::#method_name::Response };

    let tokens = quote! {
        #[candid::candid_method(#method_type)]
        fn #method_name(_: #args_name) -> #response_name {
            unimplemented!();
        }
    };

    TokenStream::from(tokens)
}

fn get_method_attribute(attrs: AttributeArgs) -> MethodAttribute {
    let canister_name = if let NestedMeta::Meta(Meta::Path(c)) = attrs.get(0).unwrap() {
        let value = c.get_ident().unwrap().to_string();
        match value.as_str() {
            "cycles_dispenser"
            | "exchange_client"
            | "group"
            | "group_index"
            | "local_group_index"
            | "local_user_index"
            | "notifications"
            | "notifications_index"
            | "online_users"
            | "proposals_bot"
            | "storage_bucket"
            | "storage_index"
            | "user"
            | "user_index" => {
                format!("{value}_canister")
            }
            _ => panic!("Unrecognised 'canister_name' value: {value:?}"),
        }
    } else {
        panic!("Unrecognised 'canister_name' value: {:?}", attrs.get(0).unwrap());
    };

    let method_name = if let NestedMeta::Meta(Meta::Path(m)) = attrs.get(1).unwrap() {
        m.get_ident().unwrap().to_string()
    } else {
        panic!("Unrecognised 'method_name' value");
    };

    let method_type = if let NestedMeta::Meta(Meta::Path(m)) = attrs.get(2).unwrap() {
        let value = m.get_ident().unwrap().to_string();
        match value.as_str() {
            "query" | "update" => value,
            _ => panic!("Unrecognised 'method_type' value: {value}"),
        }
    } else {
        panic!("Unrecognised 'method_type' value");
    };

    MethodAttribute {
        canister_name,
        method_name,
        method_type,
    }
}
