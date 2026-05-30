import { vi } from "vitest";

/**
 * Reset all Tauri mock state between tests.
 */
export function resetTauriMocks() {
  vi.clearAllMocks();
}

/**
 * Setup a mock response for a specific Tauri command.
 */
export async function mockInvoke(
  command: string,
  response: unknown,
  shouldReject = false,
) {
  const { invoke } = await import("@tauri-apps/api/core");
  const mockedInvoke = vi.mocked(invoke);
  mockedInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === command) {
      if (shouldReject) throw response;
      return response;
    }
    throw new Error(`Unexpected invoke call: ${cmd}`);
  });
}

/**
 * Setup a default catch-all mock for invoke that logs unhandled commands.
 */
export function setupDefaultInvokeMock() {
  vi.doMock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(async (command: string, args?: unknown) => {
      console.warn(`Unhandled tauri invoke: ${command}`, args);
      return undefined;
    }),
  }));
}
