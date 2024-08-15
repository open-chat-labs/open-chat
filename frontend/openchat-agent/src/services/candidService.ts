import { Actor, HttpAgent, type Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import type { Principal } from "@dfinity/principal";
import { AuthError, DestinationInvalidError, SessionExpiryError } from "openchat-shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "./error";
import { ResponseTooLargeError } from "openchat-shared";
import { ZodType } from "zod";
import { identity } from "../utils/mapping";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    console.log(msg);
}

export abstract class CandidService {
    protected createServiceClient<T>(factory: IDL.InterfaceFactory): T {
        return Actor.createActor<T>(factory, {
            agent: this.agent,
            canisterId: this.canisterId,
        });
    }

    protected get principal(): Principal {
        return this.identity.getPrincipal();
    }

    protected async executeJsonQuery<In, Resp, Out>(
        methodName: string,
        args: In,
        mapper: (from: Resp) => Out,
        requestValidator: ZodType<In>,
        responseValidator: ZodType<Resp>,
    ): Promise<Out> {
        const requestValidationResult = requestValidator.safeParse(args);
        if (!requestValidationResult.success) {
            throw new Error("Invalid request: " + requestValidationResult.error.toString());
        }
        const json = JSON.stringify(args);
        const bytes = new TextEncoder().encode(json);

        const response = await this.handleQueryResponse(
            () =>
                this.agent.query(this.canisterId, { methodName: methodName + "_json", arg: bytes }),
            identity,
            args,
        );
        if (response.status === "replied") {
            const responseJson = new TextDecoder().decode(response.reply.arg);
            const validationResult = responseValidator.safeParse(JSON.parse(responseJson));
            if (validationResult.success) {
                return mapper(validationResult.data);
            } else {
                throw new Error(validationResult.error.toString());
            }
        } else {
            throw new Error(
                `query rejected. ${{
                    code: response.reject_code,
                    message: response.reject_message,
                }}`,
            );
        }
    }

    protected handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown,
    ): Promise<To> {
        return service.then(mapper).catch((err) => {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        });
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
        retries = 0,
    ): Promise<To> {
        return serviceCall()
            .then(mapper)
            .catch((err) => {
                const responseErr = toCanisterResponseError(err as Error, this.identity);
                const debugInfo = `error: ${JSON.stringify(
                    responseErr,
                    Object.getOwnPropertyNames(responseErr),
                )}, args: ${JSON.stringify(args)}`;
                if (
                    !(responseErr instanceof ResponseTooLargeError) &&
                    !(responseErr instanceof SessionExpiryError) &&
                    !(responseErr instanceof DestinationInvalidError) &&
                    !(responseErr instanceof AuthError) &&
                    retries < MAX_RETRIES
                ) {
                    const delay = RETRY_DELAY * Math.pow(2, retries);

                    if (responseErr instanceof ReplicaNotUpToDateError) {
                        debug(
                            `query: replica not up to date, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    } else {
                        debug(
                            `query: error occurred, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    }

                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            this.handleQueryResponse(serviceCall, mapper, args, retries + 1)
                                .then(resolve)
                                .catch(reject);
                        }, delay);
                    });
                } else {
                    debug(
                        `query: Error performing query request, exiting retry loop. retries: ${retries}. ${debugInfo}`,
                    );
                    throw responseErr;
                }
            });
    }

    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterId: string,
    ) {}
}
