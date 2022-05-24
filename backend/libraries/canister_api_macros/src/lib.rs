use proc_macro::TokenStream;
use proc_macro2::{Ident, Span};
use quote::quote;
use serde::Deserialize;
use serde_tokenstream::from_tokenstream;
use syn::{parse_macro_input, ItemFn};

#[derive(Deserialize)]
struct AttributeInput {
    pub name: Option<String>,
    pub guard: Option<String>,
    #[serde(default)]
    pub manual_reply: bool,
}

#[proc_macro_attribute]
pub fn update(attr: TokenStream, item: TokenStream) -> TokenStream {
    let input: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let item = parse_macro_input!(item as ItemFn);

    let name = input.name.unwrap_or(item.sig.ident.to_string());
    let guard = input.guard.map(|g| quote! { guard = #g, });
    let manual_reply = input.manual_reply.then(|| quote! { manual_reply = "true", });

    let candid = quote! {
        #[ic_cdk_macros::update(name = #name, #guard #manual_reply)]
        #item
    };

    let msgpack_name = format!("{name}_msgpack");
    let mut msgpack_item = item.clone();
    msgpack_item.sig.ident = Ident::new(&msgpack_name, Span::call_site());

    let serializer = quote! { serializer = "serialize", };
    let deserializer = quote! { deserializer = "deserialize" };

    let msg_pack = quote! {
        use msgpack::serialize;
        use msgpack::deserialize;

        #[ic_cdk_macros::update(name = #msgpack_name, #guard #manual_reply #serializer #deserializer)]
        #msgpack_item
    };

    TokenStream::from(quote! {
        #candid

        #msg_pack
    })
}
