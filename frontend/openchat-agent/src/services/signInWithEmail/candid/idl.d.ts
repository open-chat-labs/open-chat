import type { IDL } from "@dfinity/candid";
import { GenerateMagicLinkResponse, HandleMagicLinkResponse, _SERVICE } from "./types";
export {
    GenerateMagicLinkResponse as ApiGenerateMagicLinkResponse,
    HandleMagicLinkResponse as ApiHandleMagicLinkResponse,
    _SERVICE as SignInWithEmailService,
};

export const idlFactory: IDL.InterfaceFactory;
