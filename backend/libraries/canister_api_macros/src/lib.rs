use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::{format_ident, quote};
use serde::Deserialize;
use serde_tokenstream::from_tokenstream;
use std::fmt::Formatter;
use syn::parse::{Parse, ParseStream};
use syn::{parse_macro_input, Block, FnArg, Ident, ItemFn, LitBool, Pat, PatIdent, PatType, Signature, Token};

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
    pub composite: bool,
    #[serde(default)]
    pub candid: bool,
    #[serde(default)]
    pub msgpack: bool,
    #[serde(default)]
    pub json: bool,
    #[serde(default)]
    pub fallback: bool,
    #[serde(default)]
    pub manual_reply: bool,
}

#[proc_macro_attribute]
pub fn update(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Update, attr, item)
}

#[proc_macro_attribute]
pub fn query(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Query, attr, item)
}

fn canister_api_method(method_type: MethodType, attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let item = parse_macro_input!(item as ItemFn);

    let method_type = Ident::new(method_type.to_string().as_str(), Span::call_site());

    let name = attr.name.unwrap_or_else(|| item.sig.ident.to_string());
    let guard = attr.guard.map(|g| quote! { guard = #g, });
    let composite = attr.composite.then_some(quote! { composite = true, });
    let manual_reply = attr.manual_reply.then_some(quote! { manual_reply = "true", });

    let candid = if attr.candid {
        quote! {
            #[ic_cdk::#method_type(name = #name, #guard #composite #manual_reply)]
            #item
        }
    } else {
        quote! {}
    };

    let msgpack = if attr.msgpack {
        let msgpack_name = format!("{name}_msgpack");

        let serializer_name = format!("{msgpack_name}_serializer");
        let serializer_ident = Ident::new(&serializer_name, Span::call_site());

        let deserializer_name = format!("{msgpack_name}_deserializer");
        let deserializer_ident = Ident::new(&deserializer_name, Span::call_site());

        let serializer = quote! { serializer = #serializer_name, };
        let deserializer = quote! { deserializer = #deserializer_name };

        let deserializer_impl = if attr.fallback {
            quote! { msgpack::deserialize_with_fallback }
        } else {
            quote! { msgpack::deserialize_then_unwrap }
        };

        let mut msgpack_item = item.clone();
        msgpack_item.sig.ident = Ident::new(&msgpack_name, Span::call_site());

        quote! {
            use msgpack::serialize_then_unwrap as #serializer_ident;
            use #deserializer_impl as #deserializer_ident;

            #[ic_cdk::#method_type(name = #msgpack_name, #guard #composite #manual_reply #serializer #deserializer)]
            #msgpack_item
        }
    } else {
        quote! {}
    };

    let json = if attr.json {
        let json_name = format!("{name}_json");

        let serializer_name = format!("{json_name}_serializer");
        let serializer_ident = Ident::new(&serializer_name, Span::call_site());

        let deserializer_name = format!("{json_name}_deserializer");
        let deserializer_ident = Ident::new(&deserializer_name, Span::call_site());

        let serializer = quote! { serializer = #serializer_name, };
        let deserializer = quote! { deserializer = #deserializer_name };

        let mut json_item = item.clone();
        json_item.sig.ident = Ident::new(&json_name, Span::call_site());

        quote! {
            use json::serialize_then_unwrap as #serializer_ident;
            use json::deserialize_then_unwrap as #deserializer_ident;

            #[ic_cdk::#method_type(name = #json_name, #guard #composite #manual_reply #serializer #deserializer)]
            #json_item
        }
    } else {
        quote! {}
    };

    TokenStream::from(quote! {
        #candid
        #msgpack
        #json
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
        #[ic_cdk::query(name = #validate_fn_name, #guard #manual_reply)]
        #validate_fn

        #[ic_cdk::update(name = #name, #guard #manual_reply)]
        #original_fn
    })
}

#[proc_macro]
pub fn proposal_validation(input: TokenStream) -> TokenStream {
    let attribute = parse_macro_input!(input as ValidationMethodAttribute);

    let their_service_name = format_ident!("{}", attribute.service_name);
    let their_function_name = format_ident!("{}", attribute.function_name);
    let our_function_name = format_ident!("{}_{}_validate", attribute.service_name, attribute.function_name);

    let args_type = quote! { #their_service_name::#their_function_name::Args };

    let to_string_fn = if attribute.convert_to_human_readable {
        quote! {
            human_readable::to_human_readable_string(&args)
        }
    } else {
        quote! {
            serde_json::to_string_pretty(&args).map_err(|e| e.to_string())
        }
    };

    let tokens = quote! {
        #[ic_cdk::query]
        fn #our_function_name(args: #args_type) -> Result<String, String> {
            #to_string_fn
        }
    };

    TokenStream::from(tokens)
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

struct ValidationMethodAttribute {
    service_name: String,
    function_name: String,
    convert_to_human_readable: bool,
}

impl Parse for ValidationMethodAttribute {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let service_name: Ident = input.parse()?;
        let _: Token![,] = input.parse()?;
        let function_name: Ident = input.parse()?;
        let _: Token![,] = input.parse()?;
        let convert_to_human_readable = if input.is_empty() {
            true
        } else {
            let b: LitBool = input.parse()?;
            b.value()
        };

        Ok(ValidationMethodAttribute {
            service_name: service_name.to_string(),
            function_name: function_name.to_string(),
            convert_to_human_readable,
        })
    }
}
