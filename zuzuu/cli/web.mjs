// zuzuu/cli/web.mjs — launch the visual workbench.
//
// The workbench launcher is host/data-model-agnostic (it spawns the bundled
// web-app daemon — node:* only, no v1 core). Re-exported here so the v2 router
// owns the surface; the cull (8e) relocates the implementation file into cli/
// and drops this shim.
export { web } from '../commands/web.mjs';
