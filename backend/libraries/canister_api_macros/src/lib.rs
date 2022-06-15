use proc_macro::TokenStream;
use proc_macro2::{Ident, Span};
use quote::quote;
use serde::Deserialize;
use serde_tokenstream::from_tokenstream;
use std::fmt::Formatter;
use syn::{parse_macro_input, ItemFn};

enum MethodType {
    Update,
    Query,
}

impl std::fmt::Display for MethodType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MethodType::Update => f.write_str("update"),
            MethodType::Query => f.write_str("query"),
        }
    }
}

#[derive(Deserialize)]
struct AttributeInput {
    pub name: Option<String>,
    pub guard: Option<String>,
    #[serde(default)]
    pub manual_reply: bool,
}

#[proc_macro_attribute]
pub fn update_candid_and_msgpack(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Update, attr, item, true)
}

#[proc_macro_attribute]
pub fn query_candid_and_msgpack(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Query, attr, item, true)
}

#[proc_macro_attribute]
pub fn update_msgpack(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Update, attr, item, false)
}

#[proc_macro_attribute]
pub fn query_msgpack(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Query, attr, item, false)
}

fn canister_api_method(method_type: MethodType, attr: TokenStream, item: TokenStream, include_candid: bool) -> TokenStream {
    let input: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let item = parse_macro_input!(item as ItemFn);

    let method_type = Ident::new(method_type.to_string().as_str(), Span::call_site());

    let name = input.name.unwrap_or_else(|| item.sig.ident.to_string());
    let guard = input.guard.map(|g| quote! { guard = #g, });
    let manual_reply = input.manual_reply.then(|| quote! { manual_reply = "true", });

    let msgpack_name = format!("{name}_msgpack");

    let serializer_name = format!("{msgpack_name}_serializer");
    let serializer_ident = Ident::new(&serializer_name, Span::call_site());

    let deserializer_name = format!("{msgpack_name}_deserializer");
    let deserializer_ident = Ident::new(&deserializer_name, Span::call_site());

    let serializer = quote! { serializer = #serializer_name, };
    let deserializer = quote! { deserializer = #deserializer_name };

    let candid = if include_candid {
        quote! { #[ic_cdk_macros::#method_type(name = #name, #guard #manual_reply)] }
    } else {
        quote! {}
    };
    let msgpack =
        quote! { #[ic_cdk_macros::#method_type(name = #msgpack_name, #guard #manual_reply #serializer #deserializer)] };

    TokenStream::from(quote! {
        use msgpack::serialize as #serializer_ident;
        use msgpack::deserialize as #deserializer_ident;

        #candid
        #msgpack
        #item
    })
}
