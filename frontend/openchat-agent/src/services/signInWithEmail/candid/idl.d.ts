import type { IDL } from "@dfinity/candid";
import {
    GenerateVerificationCodeResponse,
    SubmitVerificationCodeResponse,
    _SERVICE,
} from "./types";
export {
    GenerateVerificationCodeResponse as ApiGenerateVerificationCodeResponse,
    SubmitVerificationCodeResponse as ApiSubmitVerificationCodeResponse,
    _SERVICE as SignInWithEmailService,
};

export const idlFactory: IDL.InterfaceFactory;
