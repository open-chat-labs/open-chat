import { Actor, HttpAgent, type Identity, polling } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import {
    AuthError,
    DestinationInvalidError,
    ResponseTooLargeError,
    SessionExpiryError,
} from "openchat-shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "./error";
import { ZodType } from "zod";
import { identity } from "../utils/mapping";
import { UpdateCallRejectedError } from "@dfinity/agent/lib/esm/actor";

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
        const payload = CandidService.prepareJsonArgs(args, requestValidator);

        const response = await this.handleQueryResponse(
            () =>
                this.agent.query(this.canisterId, {
                    methodName: methodName + "_json",
                    arg: payload,
                }),
            identity,
            args,
        );
        if (response.status === "replied") {
            return CandidService.processJsonResponse(response.reply.arg, mapper, responseValidator);
        } else {
            throw new Error(
                `query rejected. ${{
                    code: response.reject_code,
                    message: response.reject_message,
                }}`,
            );
        }
    }

    protected async executeJsonUpdate<In, Resp, Out>(
        methodName: string,
        args: In,
        mapper: (from: Resp) => Out,
        requestValidator: ZodType<In>,
        responseValidator: ZodType<Resp>,
    ): Promise<Out> {
        const payload = CandidService.prepareJsonArgs(args, requestValidator);

        try {
            const { requestId, response } = await this.agent.call(this.canisterId, {
                methodName: methodName + "_json",
                arg: payload,
            });
            const canisterId = Principal.fromText(this.canisterId);
            if (!response.ok || response.body) {
                throw new UpdateCallRejectedError(canisterId, methodName, requestId, response);
            }
            const { reply } = await polling.pollForResponse(
                this.agent,
                canisterId,
                requestId,
                polling.defaultStrategy(),
            );
            return CandidService.processJsonResponse(reply, mapper, responseValidator);
        } catch (err) {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
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

    private static validate<T>(value: unknown, validator: ZodType<T>): T {
        const validationResult = validator.safeParse(value);
        if (validationResult.success) {
            return validationResult.data;
        } else {
            throw new Error("Validation failed: " + validationResult.error.toString());
        }
    }

    private static prepareJsonArgs<T>(value: T, validator: ZodType<T>): ArrayBuffer {
        const validated = CandidService.validate(value, validator);
        return new TextEncoder().encode(JSON.stringify(validated));
    }

    private static processJsonResponse<Resp, Out>(
        responseBytes: ArrayBuffer,
        mapper: (from: Resp) => Out,
        validator: ZodType<Resp>,
    ): Out {
        const responseJson = new TextDecoder().decode(responseBytes);
        return mapper(CandidService.validate(JSON.parse(responseJson), validator));
    }

    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterId: string,
    ) {}
}
