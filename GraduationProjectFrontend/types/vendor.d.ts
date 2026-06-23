declare module "react-hook-form" {
  import type * as React from "react"

  export type FieldValues = Record<string, unknown>
  export type FieldPath<TFieldValues extends FieldValues = FieldValues> = Extract<keyof TFieldValues, string> | string

  export type ControllerProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  > = {
    name: TName
    [key: string]: unknown
  }

  export const Controller: React.ComponentType<ControllerProps>
  export const FormProvider: React.ComponentType<{ children?: React.ReactNode; [key: string]: unknown }>
  export type FieldState = {
    error?: { message?: unknown }
    [key: string]: unknown
  }
  export function useFormContext(): {
    getFieldState: (name: string, formState?: unknown) => FieldState
  }
  export function useFormState(options?: { name?: string }): Record<string, unknown>
}

declare module "react-resizable-panels" {
  import type * as React from "react"

  export const PanelGroup: React.ComponentType<Record<string, unknown>>
  export const Panel: React.ComponentType<Record<string, unknown>>
  export const PanelResizeHandle: React.ComponentType<Record<string, unknown>>
}
