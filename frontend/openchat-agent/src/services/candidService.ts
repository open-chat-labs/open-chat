import {
    Actor,
    HttpAgent,
    type Identity,
    polling,
    ReplicaTimeError,
    UpdateCallRejectedError,
} from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import {
    AuthError,
    DestinationInvalidError,
    ResponseTooLargeError,
    SessionExpiryError,
} from "openchat-shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "./error";
import { type Options, Packr } from "msgpackr";
import { identity } from "../utils/mapping";
import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    console.log(msg);
}

const Packer = new Packr({ useRecords: false, skipValues: [undefined] } as unknown as Options);

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

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const payload = CandidService.prepareMsgpackArgs(args, requestValidator);

        const response = await this.handleQueryResponse(
            () =>
                this.agent.query(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                }),
            identity,
            args,
        );
        if (response.status === "replied") {
            return CandidService.processMsgpackResponse(
                response.reply.arg,
                mapper,
                responseValidator,
            );
        } else {
            throw new Error(
                `query rejected. Code: ${response.reject_code}. Message: ${response.reject_message}`,
            );
        }
    }

    protected async executeMsgpackUpdate<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const payload = CandidService.prepareMsgpackArgs(args, requestValidator);

        try {
            const { requestId, response } = await this.makeCanisterRequest(() =>
                this.agent.call(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                }),
            );
            const canisterId = Principal.fromText(this.canisterId);
            if (!response.ok || response.body) {
                throw new UpdateCallRejectedError(canisterId, methodName, requestId, response);
            }
            const { reply } = await this.makeCanisterRequest(() =>
                polling.pollForResponse(
                    this.agent,
                    canisterId,
                    requestId,
                    polling.defaultStrategy(),
                ),
            );
            return CandidService.processMsgpackResponse(reply, mapper, responseValidator);
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
        return this.makeCanisterRequest(() => serviceCall())
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

    private async makeCanisterRequest<T>(requestFn: () => Promise<T>, isRetry = false): Promise<T> {
        try {
            return await requestFn();
        } catch (err) {
            if (!isRetry && err instanceof ReplicaTimeError) {
                this.agent.replicaTime = err.replicaTime;
                console.log("Set replica time to " + err.replicaTime);
                return await this.makeCanisterRequest(requestFn, true);
            }
            throw err;
        }
    }

    private static validate<T extends TSchema>(value: unknown, validator: T): T {
        try {
            return Value.Parse(validator, value);
        } catch (err) {
            throw new Error("Validation failed: " + JSON.stringify(err));
        }
    }

    private static prepareMsgpackArgs<T extends TSchema>(
        value: Static<T>,
        validator: T,
    ): ArrayBuffer {
        const validated = CandidService.validate(value, validator);
        return Packer.pack(validated);
    }

    private static processMsgpackResponse<Resp extends TSchema, Out>(
        responseBytes: ArrayBuffer,
        mapper: (from: Resp) => Out,
        validator: Resp,
    ): Out {
        const response = Packer.unpack(new Uint8Array(responseBytes));
        const validated = CandidService.validate(response, validator);
        return mapper(validated);
    }

    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterId: string,
    ) {}
}
