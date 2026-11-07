/* tslint:disable */
/* eslint-disable */

/**
 * Result carrier for eigendecomposition.
 */
export class EighResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly eigenvalues: Float64Array;
    readonly eigenvectors: Float64Array;
    readonly k: number;
    readonly n: number;
}

/**
 * Result carrier for SVD (wasm-bindgen cannot return tuples).
 */
export class SvdResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly cols: number;
    readonly k: number;
    readonly rows: number;
    readonly s: Float64Array;
    readonly u: Float64Array;
    readonly vt: Float64Array;
}

/**
 * Symmetric eigendecomposition of an (n × n) matrix.
 *
 * Returns the `k` largest eigenvalues and their eigenvectors.
 * Input must be symmetric — only the lower triangle is read.
 */
export function eigh(data: Float64Array, n: number, k: number): EighResult;

/**
 * Multiply A (rows_a × cols_a) by B (cols_a × cols_b).
 *
 * Returns C as a flat row-major Float64Array of length rows_a × cols_b.
 */
export function gemm(a: Float64Array, b: Float64Array, rows_a: number, cols_a: number, cols_b: number): Float64Array;

/**
 * L2-normalize each row of an (rows × cols) matrix.
 *
 * Returns the normalized matrix as a flat row-major Float64Array.
 */
export function normalize_rows(data: Float64Array, rows: number, cols: number): Float64Array;

/**
 * Solve the linear system Ax = b where A is (n × n) and b is (n,).
 *
 * Returns x as a flat Float64Array of length n.
 */
export function solve(a: Float64Array, b: Float64Array, n: number): Float64Array;

/**
 * Compute the top-`k` singular triplets of an (rows × cols) matrix.
 *
 * Returns SvdResult with U (rows×k), S (k), Vt (k×cols).
 */
export function svd(data: Float64Array, rows: number, cols: number, k: number): SvdResult;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_eighresult_free: (a: number, b: number) => void;
    readonly __wbg_svdresult_free: (a: number, b: number) => void;
    readonly eigh: (a: number, b: number, c: number, d: number) => number;
    readonly eighresult_eigenvalues: (a: number, b: number) => void;
    readonly eighresult_eigenvectors: (a: number, b: number) => void;
    readonly eighresult_k: (a: number) => number;
    readonly eighresult_n: (a: number) => number;
    readonly gemm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly normalize_rows: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly solve: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly svd: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly svdresult_cols: (a: number) => number;
    readonly svdresult_k: (a: number) => number;
    readonly svdresult_rows: (a: number) => number;
    readonly svdresult_s: (a: number, b: number) => void;
    readonly svdresult_u: (a: number, b: number) => void;
    readonly svdresult_vt: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
