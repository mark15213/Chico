/** Browser Tool plugin: whole-call composition and keyed atomic Tool views. */
export { apply, inject } from './apply.ts'
export type { ToolCallOwnerProps, ToolCallViewProps, ToolDetailsProps, ToolTreeProps } from './contract/slots.ts'
// The row chrome and its derivation are exported so a registrant that owns its
// own card kind composes the shared row instead of forking it; `customCard`
// is the seat such a registrant fills.
export { ToolRow } from './tool/components/ToolRow.tsx'
export type { ToolRowProps } from './tool/components/ToolRow.tsx'
export { toolRowModel } from './tool/models/tool-call-model.ts'
export type { ToolRowModel, ToolRowState, ToolRowVariant } from './tool/models/tool-call-model.ts'
