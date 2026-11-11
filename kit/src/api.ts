import { invoke } from "@tauri-apps/api/core"

/** The error every Rust command returns (AppError): a kind and a message written for the user. */
export interface CommandError {
  kind: string
  message: string
}

const isCommandError = (value: unknown): value is CommandError =>
  typeof value === "object" && value !== null && typeof (value as CommandError).message === "string"

/** The message to show for a failed command; never a raw error string from the runtime. */
export const messageFor = (error: unknown): string =>
  isCommandError(error) ? error.message : "Something went wrong. Try again."

/** Calls a Rust command. Every frontend call goes through here so failures reach the error banner. */
export const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> => invoke<T>(command, args)
