use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::punctuated::Punctuated;
use syn::{parse_macro_input, Ident, Token};

struct MethodAttribute {
    canister_name: String,
    method_name: String,
}

#[proc_macro]
pub fn generate_ts_method(input: TokenStream) -> TokenStream {
    let inputs = parse_macro_input!(input with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let attribute = get_method_attribute(inputs);

    let canister_module = format_ident!("{}_canister", attribute.canister_name);
    let method_name = format_ident!("{}", attribute.method_name);

    let tokens = quote! {
        <#canister_module::#method_name::Args as ::ts_rs::TS>::export_all_to("ts_bindings").unwrap();
        <#canister_module::#method_name::Response as ::ts_rs::TS>::export_all_to("ts_bindings").unwrap();
    };

    TokenStream::from(tokens)
}

fn get_method_attribute(inputs: Vec<String>) -> MethodAttribute {
    let first_arg = inputs.first().unwrap();
    let second_arg = inputs.get(1).unwrap();

    let canister_name = first_arg.to_string();
    let method_name = second_arg.to_string();

    MethodAttribute {
        canister_name,
        method_name,
    }
}
