use proc_macro::TokenStream;
use proc_macro2::{Ident, Span};
use quote::quote;
use serde::Deserialize;
use serde_tokenstream::from_tokenstream;
use std::fmt::Formatter;
use syn::{parse_macro_input, Block, FnArg, ItemFn, Pat, PatIdent, PatType, Signature};

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
    let attr: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let item = parse_macro_input!(item as ItemFn);

    let method_type = Ident::new(method_type.to_string().as_str(), Span::call_site());

    let name = attr.name.unwrap_or_else(|| item.sig.ident.to_string());
    let guard = attr.guard.map(|g| quote! { guard = #g, });
    let manual_reply = attr.manual_reply.then_some(quote! { manual_reply = "true", });

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
        use msgpack::serialize_then_unwrap as #serializer_ident;
        use msgpack::deserialize_then_unwrap as #deserializer_ident;

        #candid
        #msgpack
        #item
    })
}

#[proc_macro_attribute]
pub fn proposal(attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let original_fn = parse_macro_input!(item as ItemFn);

    let name = attr.name.unwrap_or_else(|| original_fn.sig.ident.to_string());
    let validate_fn_name = format!("{name}_validate");
    let guard = attr.guard.map(|g| quote! { guard = #g, });
    let manual_reply = attr.manual_reply.then_some(quote! { manual_reply = "true", });

    let validate_fn = convert_to_validate_fn(original_fn.clone());

    TokenStream::from(quote! {
        #[ic_cdk_macros::query(name = #validate_fn_name, #guard #manual_reply)]
        #validate_fn

        #[ic_cdk_macros::update(name = #name, #guard #manual_reply)]
        #original_fn
    })
}

fn convert_to_validate_fn(original: ItemFn) -> ItemFn {
    let mut sig = original.sig;
    let name = format!("{}_validate", sig.ident);
    sig.ident = Ident::new(&name, Span::call_site());
    sig.output = syn::parse2(quote!(-> Result<String, String>)).unwrap();
    sig.asyncness = None;

    let arg_names = get_arg_names(&sig);
    let args = match arg_names.len() {
        1 => quote! { #(#arg_names),* },
        _ => quote! { (#(#arg_names),*) },
    };

    let block: Block = syn::parse2(quote! {
        {
            human_readable::to_human_readable_string(&#args)
        }
    })
    .unwrap();

    ItemFn {
        attrs: original.attrs,
        vis: original.vis,
        sig,
        block: Box::new(block),
    }
}

fn get_arg_names(signature: &Signature) -> Vec<Ident> {
    signature
        .inputs
        .iter()
        .map(|arg| match arg {
            FnArg::Receiver(r) => r.self_token.into(),
            FnArg::Typed(PatType { pat, .. }) => {
                if let Pat::Ident(PatIdent { ident, .. }) = pat.as_ref() {
                    ident.clone()
                } else {
                    panic!("Unable to determine arg name");
                }
            }
        })
        .collect()
}
