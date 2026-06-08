import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatAgent } from "./useChatAgent";


const mockSetChatHistory = vi.fn();
let mockChatHistoryValue: any[] = [];


vi.mock("../../../editor-jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../editor-jotai")>();
  return {
    ...actual,
    useAtom: () => [mockChatHistoryValue, mockSetChatHistory],
  };
});

vi.mock("../../TTDDialog/utils/chat", () => ({
  addMessages: vi.fn((prev, messages) => [...prev, ...messages]),
  updateAssistantContent: vi.fn((prev, updates) => ({ ...prev, ...updates })),
}));

import { addMessages, updateAssistantContent } from "../../TTDDialog/utils/chat";

describe("useChatAgent - Combined Test Suite (Black-Box & White-Box)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatHistoryValue = [];
    
    // Simulates the behavior of the Jotai/React State updater
    mockSetChatHistory.mockImplementation((updater) => {
      if (typeof updater === "function") {
        mockChatHistoryValue = updater(mockChatHistoryValue);
      } else {
        mockChatHistoryValue = updater;
      }
    });
  });

  
  describe("Method: setAssistantError", () => {
    
   
    
    it("[Black-Box] Should correctly process valid equivalence classes of error types", () => {
      const { result } = renderHook(() => useChatAgent());

      act(() => {
        result.current.setAssistantError("Network error", "network");
      });

      expect(updateAssistantContent).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
        isGenerating: false,
        error: "Network error",
        errorType: "network"
      }));
    });

    it("[Black-Box] Should use 'other' as default value when error type is unspecified (Boundary/Optional Value)", () => {
    
      const { result } = renderHook(() => useChatAgent());

      act(() => {
        result.current.setAssistantError("Generic error");
      });

      expect(updateAssistantContent).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
        errorType: "other"
      }));
    });

  
    
    it("[White-Box] Should cover the True Branch where the error is an instance of Error (Type Verification)", () => {
      
      const { result } = renderHook(() => useChatAgent());
      const fakeError = new TypeError("Simulated type failure");

      act(() => {
        result.current.setAssistantError("Failed", "parse", fakeError);
      });

      expect(updateAssistantContent).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
        errorDetails: expect.stringContaining('"name":"TypeError"'),
      }));
    });

    it("[White-Box] Should cover the False Branch where errorDetails is not an instance of Error", () => {
     
      const { result } = renderHook(() => useChatAgent());
      const stringError = "Custom error in raw string format";

      act(() => {
        result.current.setAssistantError("Failed", "other", stringError);
      });

   
      const calls = vi.mocked(updateAssistantContent).mock.calls;
      const lastPayload = calls[calls.length - 1][1]; 
      
      expect(lastPayload.errorDetails).toContain('"name":"Error"');
      expect(lastPayload.errorDetails).toContain('"message":"Custom error in raw string format"');
    });

    it("[White-Box] Should cover the Branch where errorDetails is undefined", () => {
      
      const { result } = renderHook(() => useChatAgent());

      act(() => {
        result.current.setAssistantError("No details", "other", undefined);
      });

      expect(updateAssistantContent).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
        errorDetails: undefined
      }));
    });
  });

  
  describe("Message Flow and Retry Methods", () => {

   

    it("[White-Box] Should cover the complete structural execution of addUserMessage", () => {
      
      const { result } = renderHook(() => useChatAgent());

      act(() => {
        result.current.addUserMessage("Hello");
      });

      expect(addMessages).toHaveBeenCalledTimes(1);
      expect(mockSetChatHistory).toHaveBeenCalledTimes(1);
    });

    it("[White-Box] Should guarantee that setLastRetryAttempt generates and injects a valid timestamp", () => {
      
      const { result } = renderHook(() => useChatAgent());
      const RealDate = global.Date.now;
      global.Date.now = () => 1600000000000; 

      act(() => {
        result.current.setLastRetryAttempt();
      });

      expect(updateAssistantContent).toHaveBeenCalledWith(expect.any(Array), {
        lastAttemptAt: 1600000000000
      });

      global.Date.now = RealDate; 
    });

    

    it("[Black-Box] Should format the user payload strictly according to the Schema specification", () => {
    
      const { result } = renderHook(() => useChatAgent());
      const messageText = "Draw a rectangle";

      act(() => {
        result.current.addUserMessage(messageText);
      });

      expect(addMessages).toHaveBeenCalledWith(
        expect.any(Array), 
        [{ type: "user", content: messageText }]
      );
    });

    it("[Black-Box] Should initialize assistant state with correct loading properties", () => {
      const { result } = renderHook(() => useChatAgent());

      act(() => {
        result.current.addAssistantMessage();
      });

      expect(addMessages).toHaveBeenCalledWith(
        expect.any(Array), 
        [{ type: "assistant", content: "", isGenerating: true }]
      );
    });
  });
});