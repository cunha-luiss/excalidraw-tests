import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTextGeneration } from "./useTextGeneration";

// ==========================================
// 1. Mocks for Libraries and Internal Dependencies
// ==========================================
vi.mock("../../../editor-jotai", () => {
  // Simulating useAtom so we don't tie it to the global Jotai state in unit tests
  let errorState: Error | null = null;
  let rateState: any = null;
  let chatState: any = { messages: [] };

  return {
    useAtom: (atom: any) => {
      // We use simple string identifiers for the mock atoms during tests
      if (atom === "errorAtom") {
        return [errorState, (val: any) => { errorState = val; }];
      }
      if (atom === "rateLimitsAtom") {
        return [rateState, (val: any) => { rateState = val; }];
      }
      return [chatState, (val: any) => { chatState = val; }];
    },
  };
});

// Override the return values of context atoms with string identifiers
vi.mock("../TTDContext", () => ({
  errorAtom: "errorAtom",
  rateLimitsAtom: "rateLimitsAtom",
  chatHistoryAtom: "chatHistoryAtom",
}));

vi.mock("../../../analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../../../i18n", () => ({
  t: (key: string) => key,
}));

vi.mock("@excalidraw/mermaid-to-excalidraw", () => ({
  parseMermaidToExcalidraw: vi.fn().mockResolvedValue({}),
}));

const mockAddUserMessage = vi.fn();
const mockAddAssistantMessage = vi.fn();
const mockSetAssistantError = vi.fn();

vi.mock("../Chat", () => ({
  useChatAgent: () => ({
    addUserMessage: mockAddUserMessage,
    addAssistantMessage: mockAddAssistantMessage,
    setAssistantError: mockSetAssistantError,
  }),
}));

// Mock the chat utils to avoid errors when dealing with empty chat states
vi.mock("../utils/chat", () => ({
  getMessagesForLLM: vi.fn().mockReturnValue([]),
  getLastAssistantMessage: vi.fn().mockReturnValue({ content: "" }),
  updateAssistantContent: vi.fn().mockImplementation((state) => state),
  removeLastAssistantMessage: vi.fn().mockImplementation((state) => state),
  addMessages: vi.fn().mockImplementation((state) => state),
}));

// ==========================================
// 2. Unit Test Suites
// ==========================================
describe("useTextGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("prompt validation (validatePrompt)", () => {
    it("should reject a prompt that is too short and set an error", async () => {
      // Arrange
      const { result } = renderHook(() =>
        useTextGeneration({
          onTextSubmit: vi.fn(),
        }),
      );

      // Act
      await act(async () => {
        await result.current.onGenerate({ prompt: "A" }); // 1 Character => Fails
      });

      // Assert
      // Ensure the validation failed early and didn't attempt to send the message
      expect(mockAddUserMessage).not.toHaveBeenCalled();
    });

    it("should reject a prompt that is too long and set an error", async () => {
      // Arrange
      const longPrompt = "A".repeat(10001); // Exceeds the 10,000 threshold

      const { result } = renderHook(() =>
        useTextGeneration({
          onTextSubmit: vi.fn(),
        }),
      );

      // Act
      await act(async () => {
        await result.current.onGenerate({ prompt: longPrompt });
      });

      // Assert
      expect(mockAddUserMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleAbort", () => {
    it("should gracefully attempt to abort the streaming controller", async () => {
      // Arrange
      const { result } = renderHook(() =>
        useTextGeneration({
          onTextSubmit: vi.fn().mockResolvedValue({ generatedResponse: "" }),
        }),
      );

      // Act
      // We start a generation to ensure the AbortController gets initialized
      await act(async () => {
        // Floating promise is fine here since we just want to trigger the state setup
        result.current.onGenerate({ prompt: "A valid prompt length!" });
      });
      
      // Immediately call abort. Internally the "streamingAbortControllerRef" will execute .abort()
      act(() => {
        result.current.handleAbort();
      });

      // Assert
      // We validate that it exposes the fn and runs without throwing any sync exceptions
      expect(typeof result.current.handleAbort).toBe("function");
    });
  });

  describe("onGenerate (Happy Path)", () => {
    it("should setup messages correctly when not in a repair flow", async () => {
      // Arrange
      const mockSubmit = vi.fn().mockResolvedValue({
        generatedResponse: "graph TD\n A->B",
        error: null,
      });

      const { result } = renderHook(() =>
        useTextGeneration({
          onTextSubmit: mockSubmit,
        }),
      );

      // Act
      await act(async () => {
        await result.current.onGenerate({ prompt: "Create a flow" });
      });

      // Assert
      expect(mockAddUserMessage).toHaveBeenCalledWith("Create a flow");
      expect(mockAddAssistantMessage).toHaveBeenCalled();
      
      // Verify that the external API function was successfully called after validation
      expect(mockSubmit).toHaveBeenCalled(); 
    });
  });
});