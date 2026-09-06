/**
 * Serializes asynchronous WebGPU compute-pipeline compilation per device.
 *
 * Chromium's WebGPU bridge is allowed to compile multiple pipelines concurrently. Some Android
 * Adreno drivers crash inside their native Vulkan shader compiler when that happens, taking the
 * entire WebView host process down before JavaScript can observe an error. Keeping the native calls
 * one-at-a-time preserves the WebGPU execution provider while avoiding that driver race.
 */

type PipelineDescriptorLike = {
    readonly label?: string;
    readonly compute?: {
        readonly module?: { readonly label?: string };
        readonly entryPoint?: string;
    };
};

type ShaderModuleDescriptorLike = {
    readonly label?: string;
    readonly code: string;
};

const STANDARD_SOFTMAX_ROUTING_FLAG = "__openchatOrtStandardSoftmaxRouting";
const ORT_SMOOTH_SOFTMAX_MAX = "var max_value: f32 = 0.0;";
const ORT_STANDARD_SOFTMAX_MAX = "var max_value = f32(-3.4028234663852886e+38f);";
const ORT_SMOOTH_SOFTMAX_DENOMINATOR = "sum += exp(-max_value);";

const serializedDevices = new WeakSet<object>();
const serializedAdapters = new WeakMap<object, object>();
const serializedGpuApis = new WeakSet<object>();

/**
 * Gemma's pinned decoder uses smooth_softmax=1 only as an ORT routing bit: it prevents the
 * Qualcomm-crashing FlashAttention program from being selected. The shader wrapper below removes
 * the smooth-softmax sentinel again, so the non-flash WebGPU path computes ordinary softmax and
 * retains the model's original 512-token sliding-window behavior.
 */
export function setOrtWebGpuStandardSoftmaxRouting(enabled: boolean): void {
    Reflect.set(globalThis, STANDARD_SOFTMAX_ROUTING_FLAG, enabled);
}

function standardSoftmaxShader(descriptor: ShaderModuleDescriptorLike): ShaderModuleDescriptorLike {
    if (
        Reflect.get(globalThis, STANDARD_SOFTMAX_ROUTING_FLAG) !== true ||
        typeof descriptor.code !== "string"
    ) {
        return descriptor;
    }
    const maxCount = descriptor.code.split(ORT_SMOOTH_SOFTMAX_MAX).length - 1;
    const denominatorCount = descriptor.code.split(ORT_SMOOTH_SOFTMAX_DENOMINATOR).length - 1;
    if (maxCount === 0 && denominatorCount === 0) return descriptor;
    if (maxCount !== 1 || denominatorCount !== 1) {
        throw new Error(
            "The pinned ORT smooth-softmax shader changed; refusing to run Gemma with altered attention semantics.",
        );
    }
    console.info("[webgpu-shader] neutralized Gemma smooth-softmax routing marker");
    return {
        ...descriptor,
        code: descriptor.code
            .replace(ORT_SMOOTH_SOFTMAX_MAX, ORT_STANDARD_SOFTMAX_MAX)
            .replace(ORT_SMOOTH_SOFTMAX_DENOMINATOR, ""),
    };
}

export function serializeWebGpuPipelineCompilation<T extends object>(device: T): T {
    if (serializedDevices.has(device)) return device;

    const nativeCreate = Reflect.get(device, "createComputePipelineAsync", device);
    if (typeof nativeCreate !== "function") {
        throw new TypeError("The WebGPU device does not expose createComputePipelineAsync().");
    }
    const nativeCreateShaderModule = Reflect.get(device, "createShaderModule", device);
    if (typeof nativeCreateShaderModule !== "function") {
        throw new TypeError("The WebGPU device does not expose createShaderModule().");
    }
    let tail: Promise<unknown> = Promise.resolve();
    let sequence = 0;
    const create = (descriptor: PipelineDescriptorLike): Promise<unknown> => {
        const id = ++sequence;
        const label =
            descriptor.label || descriptor.compute?.module?.label || descriptor.compute?.entryPoint;
        const result = tail.then(async () => {
            console.info(`[webgpu-pipeline] ${id} compiling ${label || "unlabelled compute"}`);
            try {
                return await Reflect.apply(nativeCreate, device, [descriptor]);
            } finally {
                console.info(`[webgpu-pipeline] ${id} compilation finished`);
            }
        });
        tail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };

    Object.defineProperty(device, "createComputePipelineAsync", {
        configurable: true,
        value: create,
    });
    Object.defineProperty(device, "createShaderModule", {
        configurable: true,
        value: (descriptor: ShaderModuleDescriptorLike) =>
            Reflect.apply(nativeCreateShaderModule, device, [standardSoftmaxShader(descriptor)]),
    });
    serializedDevices.add(device);
    return device;
}

export function adapterWithSerializedWebGpuPipelines<T extends object>(adapter: T): T {
    const existing = serializedAdapters.get(adapter);
    if (existing !== undefined) return existing as T;

    const requestDevice = Reflect.get(adapter, "requestDevice", adapter);
    if (typeof requestDevice !== "function") {
        throw new TypeError("The WebGPU adapter does not expose requestDevice().");
    }
    const wrapped = new Proxy(adapter, {
        get(target, property) {
            if (property === "requestDevice") {
                return async (...args: unknown[]) =>
                    serializeWebGpuPipelineCompilation(
                        await Reflect.apply(requestDevice, target, args),
                    );
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
    serializedAdapters.set(adapter, wrapped);
    return wrapped;
}

/**
 * Installs the adapter wrapper at the navigator.gpu boundary.
 *
 * The pinned ORT JSPI bridge creates its own adapter instead of using env.webgpu.adapter. Wrapping
 * only the adapter used by our preflight therefore does not reach ORT. navigator.gpu is a
 * [SameObject] Web API, so installing one own requestAdapter method here also wraps every adapter
 * the JSPI bridge requests later in this worker.
 */
export function installSerializedWebGpuPipelineCompilation<T extends object>(gpu: T): T {
    if (serializedGpuApis.has(gpu)) return gpu;

    const requestAdapter = Reflect.get(gpu, "requestAdapter", gpu);
    if (typeof requestAdapter !== "function") {
        throw new TypeError("The WebGPU API does not expose requestAdapter().");
    }
    const wrappedRequestAdapter = async (...args: unknown[]): Promise<unknown> => {
        const adapter = await Reflect.apply(requestAdapter, gpu, args);
        return typeof adapter === "object" && adapter !== null
            ? adapterWithSerializedWebGpuPipelines(adapter)
            : adapter;
    };
    Object.defineProperty(gpu, "requestAdapter", {
        configurable: true,
        value: wrappedRequestAdapter,
    });
    if (Reflect.get(gpu, "requestAdapter", gpu) !== wrappedRequestAdapter) {
        throw new Error("The WebGPU adapter boundary could not be wrapped safely.");
    }
    serializedGpuApis.add(gpu);
    return gpu;
}
