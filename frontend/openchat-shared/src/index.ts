export * from "./domain";
export * from "./utils";
export { getUserStatus, userStatus, missingUserIds } from "./domain/user/user.utils";

// This is a fn which will be given the retry iteration number and return a boolean indicating whether to *stop* retrying
export type ServiceRetryInterrupt = (iterations: number) => boolean;
