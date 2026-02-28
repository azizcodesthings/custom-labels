import { AsyncLocalStorage } from "node:async_hooks";

export type LabelValue = string | boolean | number | null | undefined;

type Labels = Record<string, string>;
type WithLabels = <T>(f: () => T, ...kvs: LabelValue[]) => T;
type CurLabels = () => Labels | undefined;

interface CustomLabelsAddon {
    ClWrap: new (current: Labels | undefined, ...kvs: LabelValue[]) => Labels;
    storeHash: (als: AsyncLocalStorage<Labels>) => void;
}

const bindings = require("bindings") as (name: string) => unknown;

let withLabels: WithLabels;
let curLabels: CurLabels;

if (process.platform === "linux") {
    const addon = bindings("customlabels") as CustomLabelsAddon;
    let als: AsyncLocalStorage<Labels> | undefined;

    function asyncContextFrameError(): string | undefined {
        const [major] = process.versions.node.split(".").map(Number);

        // If explicitly disabled, it's not in use.
        if (process.execArgv.includes("--no-async-context-frame")) {
            return "Node explicitly launched with --no-async-context-frame";
        }

        // Since Node 24, AsyncContextFrame is the default unless disabled.
        if (major >= 24) {
            return undefined;
        }

        // In Node 22/23, it existed behind an experimental flag.
        if (process.execArgv.includes("--experimental-async-context-frame")) {
            return undefined;
        }
        if (major >= 22) {
            return "Node versions prior to v24 must be launched with --experimental-async-context-frame";
        }

        // Older versions: not available.
        return "Node major versions prior to v22 do not support the feature at all";
    }

    function ensureHook(): AsyncLocalStorage<Labels> {
        if (als) {
            return als;
        }

        const err = asyncContextFrameError();
        if (err) {
            throw new Error(
                `Custom labels requires async_context_frame support, which is unavailable: ${err}.`,
            );
        }

        als = new AsyncLocalStorage<Labels>();
        addon.storeHash(als);
        return als;
    }

    curLabels = function curLabelsImpl() {
        return ensureHook().getStore();
    };

    withLabels = function withLabelsImpl<T>(f: () => T, ...kvs: LabelValue[]): T {
        const store = ensureHook();
        const labels = curLabels();
        const newLabels = new addon.ClWrap(labels, ...kvs);
        return store.run(newLabels, f);
    };
} else {
    withLabels = function withLabelsImpl<T>(f: () => T): T {
        return f();
    };

    curLabels = function curLabelsImpl() {
        return undefined;
    };
}

export { withLabels, curLabels };
