import type { Identity } from "@dfinity/agent";
import { AuthProvider } from "../domain/auth";
export declare function getIdentity(): Promise<Identity>;
export declare function isAuthenticated(): Promise<boolean>;
export declare function login(authProvider: AuthProvider): Promise<Identity>;
export declare function logout(): Promise<void>;
export declare function startSession(identity: Identity): Promise<void>;
export declare function getTimeUntilSessionExpiryMs(identity: Identity): number;
