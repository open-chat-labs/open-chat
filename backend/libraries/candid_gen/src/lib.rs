use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::punctuated::Punctuated;
use syn::{parse_macro_input, Ident, Token};

struct MethodAttribute {
    canister_name: String,
    method_name: String,
    method_type: String,
}

#[proc_macro]
pub fn generate_candid_method(input: TokenStream) -> TokenStream {
    let inputs = parse_macro_input!(input with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let attribute = get_method_attribute(inputs);

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

#[proc_macro]
pub fn generate_candid_method_no_args(input: TokenStream) -> TokenStream {
    let inputs = parse_macro_input!(input with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let attribute = get_method_attribute(inputs);

    let canister_name = format_ident!("{}", attribute.canister_name);
    let method_name = format_ident!("{}", attribute.method_name);
    let method_type = format_ident!("{}", attribute.method_type);

    let response_name = quote! { #canister_name::#method_name::Response };

    let tokens = quote! {
        #[candid::candid_method(#method_type)]
        fn #method_name() -> #response_name {
            unimplemented!();
        }
    };

    TokenStream::from(tokens)
}

fn get_method_attribute(inputs: Vec<String>) -> MethodAttribute {
    let first_arg = inputs.get(0).unwrap();
    let second_arg = inputs.get(1).unwrap();
    let third_arg = inputs.get(2).unwrap();

    let canister_name = format!("{first_arg}_canister");

    let method_name = second_arg.to_string();

    let method_type = match third_arg.as_str() {
        "query" | "update" => third_arg.to_string(),
        _ => panic!("Unrecognised 'method_type' value: {third_arg}"),
    };

    MethodAttribute {
        canister_name,
        method_name,
        method_type,
    }
}
