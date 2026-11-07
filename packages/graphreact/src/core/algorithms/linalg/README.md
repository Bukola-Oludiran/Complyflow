# graphreact-linalg

Minimal Rust → WASM linear algebra kernel for GraphReact's spectral graph algorithms. **256 KB** binary, zero JS dependencies.

## Layout

```
linalg/
├── graphreact_linalg.js            ← wasm-pack generated JS glue
├── graphreact_linalg.d.ts          ← wasm-pack generated TS types
├── graphreact_linalg_bg.wasm       ← compiled binary (256 KB)
├── graphreact_linalg_bg.wasm.d.ts  ← WASM binary type stubs
├── index.ts                        ← barrel re-export for GraphReact
└── README.md
```

## Usage

```ts
import init, { svd, eigh, gemm, solve, normalize_rows } from './linalg/index.js';

// Initialise once — auto-resolves .wasm via import.meta.url:
await init();

// SVD
const { u, s, vt } = svd(matrix, rows, cols, k);

// Eigendecomposition (largest k)
const { eigenvalues, eigenvectors } = eigh(symmetricMatrix, n, k);

// Matrix multiply
const c = gemm(a, b, rowsA, colsA, colsB);

// Linear solve
const x = solve(a, b, n);

// Row normalization
const normalized = normalize_rows(data, rows, cols);
```

All matrices are flat `Float64Array` in **row-major** order.

## Rebuilding

The Rust crate source is not included in this repository. With the crate checked out as `crate/`, rebuild with:

```bash
cd crate
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
wasm-pack build --target web --release
```

Then copy outputs back:

```bash
cp pkg/graphreact_linalg.js pkg/graphreact_linalg.d.ts \
   pkg/graphreact_linalg_bg.wasm pkg/graphreact_linalg_bg.wasm.d.ts \
   ../
```

## Build notes

- **wasm-opt disabled** in `Cargo.toml` — bundled wasm-opt lags behind Rust's WASM feature output (bulk memory, saturating float-to-int). Rust's own LTO + `opt-level = "s"` handles optimization.
- **faer 0.20** — pure Rust linear algebra, no C/LAPACK dependencies, clean WASM compilation.
- Decomposition accessors (`s_diagonal()`, `s()`) return lean `ColRef` views, not full matrices.

## Exports

| Function         | Used by                              |
|------------------|--------------------------------------|
| `svd`            | ASE, LSE spectral embeddings         |
| `eigh`           | Laplacian eigendecomposition         |
| `gemm`           | Procrustes alignment, GMM fitting    |
| `solve`          | Model parameter estimation           |
| `normalize_rows` | Embedding post-processing            |
