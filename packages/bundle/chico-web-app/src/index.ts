/**
 * `@deepseek-ai/dsh-chico-web-app` — the Chico investment-surface bundle. The
 * whole bundle is its patch (`cordis.patch.yml`, declared by the
 * `dsh.bundle.patch` manifest field): it inserts the market-data seam, its
 * provider, the model-facing tools, the durable name services, and the
 * investing frame over the dsh-web-app layer.
 *
 * The plugin body is empty by design. This layer adds capability rows and no
 * runtime glue of its own; a Chico-specific service would belong in its own
 * package rather than here, where it would be invisible to any composition
 * that patches differently.
 * @module @deepseek-ai/dsh-chico-web-app
 */

/** Stable Cordis plugin name. */
export const name = 'chico-web-app'

/** Bundle plugin body — the patch layer carries this bundle's whole effect. */
export function apply(): void {}
