use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(HumanReadable)]
pub fn human_readable_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let name = &input.ident;

    TokenStream::from(quote! {
        impl human_readable::ToHumanReadable for #name {
            type Target = Self;

            fn to_human_readable(&self) -> Self {
                self.clone()
            }
        }
    })
}
