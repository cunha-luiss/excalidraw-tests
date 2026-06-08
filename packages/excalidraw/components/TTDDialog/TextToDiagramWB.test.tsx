import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TextToDiagram } from "./TextToDiagram";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const setAppStateMock = vi.fn();
const onGenerateMock = vi.fn();
const handleAbortMock = vi.fn();
const setErrorMock = vi.fn();
const setChatHistoryMock = vi.fn();
const setLastRetryAttemptMock = vi.fn();

let mockChatHistory: any = null;

const defaultChatHistory = {
  id: "chat-1",
  currentPrompt: "",
  messages: [
    {
      id: "user-1",
      type: "user",
      content: "user prompt",
      timestamp: new Date(),
    },
    {
      id: "assistant-1",
      type: "assistant",
      content: "graph TD; A-->B",
      isGenerating: false,
      timestamp: new Date(),
    },
    {
      id: "assistant-2",
      type: "assistant",
      content: "graph TD; A-->B",
      error: "parse error",
      errorType: "parse",
      isGenerating: false,
      timestamp: new Date(),
    },
  ],
};

vi.mock("../App", () => ({
  useApp: () => ({
    state: {
      theme: "light",
    },
  }),
  useExcalidrawSetAppState: () => setAppStateMock,
}));

vi.mock("./TTDContext", () => ({
  errorAtom: { __atomName: "errorAtom" },
  chatHistoryAtom: { __atomName: "chatHistoryAtom" },
  showPreviewAtom: { __atomName: "showPreviewAtom" },
  rateLimitsAtom: { __atomName: "rateLimitsAtom" },
}));

vi.mock("../../editor-jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAtom: vi.fn((atom: any) => {
      if (atom?.__atomName === "errorAtom") {
        return [null, setErrorMock];
      }

      if (atom?.__atomName === "chatHistoryAtom") {
        return [mockChatHistory, setChatHistoryMock];
      }

      return [null, vi.fn()];
    }),
    useAtomValue: (atom: any) => atom?.__atomName === "showPreviewAtom",
  };
});

vi.mock("./hooks/useTextGeneration", () => ({
  useTextGeneration: () => ({
    onGenerate: onGenerateMock,
    handleAbort: handleAbortMock,
  }),
}));

vi.mock("./hooks/useMermaidRenderer", () => ({
  useMermaidRenderer: () => ({
    data: {},
  }),
}));

vi.mock("./hooks/useChatManagement", () => ({
  useChatManagement: () => ({
    isMenuOpen: false,
    onRestoreChat: vi.fn(),
    handleDeleteChat: vi.fn(),
    handleNewChat: vi.fn(),
    handleMenuToggle: vi.fn(),
    handleMenuClose: vi.fn(),
  }),
}));

vi.mock("./useTTDChatStorage", () => ({
  useTTDChatStorage: () => ({
    savedChats: [],
  }),
}));

vi.mock("./Chat", () => ({
  useChatAgent: () => ({
    setLastRetryAttempt: setLastRetryAttemptMock,
  }),
}));

vi.mock("./common", () => ({
  convertMermaidToExcalidraw: vi.fn(),
  insertToEditor: vi.fn(),
  saveMermaidDataToStorage: vi.fn(),
}));

vi.mock("./TTDPreviewPanel", () => ({
  TTDPreviewPanel: (props: any) => (
    <div data-testid="preview-panel">
      <span>{props.hideErrorDetails ? "hide-error" : "show-error"}</span>
    </div>
  ),
}));

const renderComponent = () => {
  return render(
    <TextToDiagram
      mermaidToExcalidrawLib={{
        loaded: true,
      }}
      persistenceAdapter={{} as any}
      onTextSubmit={vi.fn()}
    />,
  );
};

describe("TextToDiagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatHistory = { ...defaultChatHistory };
  });

  describe("onViewAsMermaid", () => {
    it("should open Mermaid tab when valid content exists", async () => {
      renderComponent();

      const viewAsMermaidButtons = screen.getAllByRole("button", {
        name: /view.*mermaid/i,
      });
      fireEvent.click(viewAsMermaidButtons[0]);

      const common = await import("./common");

      expect(common.saveMermaidDataToStorage).toHaveBeenCalled();
      expect(setAppStateMock).toHaveBeenCalledWith({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    });
  });

  describe("handleMermaidTabClick", () => {
    it("should save content and open Mermaid tab", async () => {
      renderComponent();

      const viewAsMermaidButtons = screen.getAllByRole("button", {
        name: /view.*mermaid/i,
      });
      fireEvent.click(viewAsMermaidButtons[viewAsMermaidButtons.length - 1]);

      const common = await import("./common");

      expect(common.saveMermaidDataToStorage).toHaveBeenCalledWith(
        defaultChatHistory.messages[2].content,
      );
      expect(setAppStateMock).toHaveBeenCalledWith({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    });

    it("should do nothing when content is empty", async () => {
      mockChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "user-1",
            type: "user",
            content: "user prompt",
            timestamp: new Date(),
          },
          {
            id: "assistant-2",
            type: "assistant",
            content: "",
            error: "parse error",
            errorType: "parse",
            isGenerating: false,
            timestamp: new Date(),
          },
        ],
      };
      renderComponent();

      const viewAsMermaidButtons = screen.queryAllByRole("button", {
        name: /view.*mermaid/i,
      });

      expect(viewAsMermaidButtons.length).toBe(0);
    });
  });

  describe("handleInsertMessage", () => {
    it("should not convert when content is empty", async () => {
      mockChatHistory = {
        ...defaultChatHistory,
        messages: [
          defaultChatHistory.messages[0],
          {
            ...defaultChatHistory.messages[1],
            content: "",
          },
          defaultChatHistory.messages[2],
        ],
      };
      renderComponent();

      const insertButton = screen.getByRole("button", { name: /insert/i });
      fireEvent.click(insertButton);

      const common = await import("./common");
      expect(common.convertMermaidToExcalidraw).not.toHaveBeenCalled();
      expect(common.insertToEditor).not.toHaveBeenCalled();
    });

    it("should not convert when library is not loaded", async () => {
      const { getByRole } = render(
        <TextToDiagram
          mermaidToExcalidrawLib={{ loaded: false } as any}
          persistenceAdapter={{} as any}
          onTextSubmit={vi.fn()}
        />,
      );

      const insertButton = getByRole("button", { name: /insert/i });
      fireEvent.click(insertButton);

      const common = await import("./common");
      expect(common.convertMermaidToExcalidraw).not.toHaveBeenCalled();
      expect(common.insertToEditor).not.toHaveBeenCalled();
    });

    it("should convert and insert into editor when successful", async () => {
      const common = await import("./common");
      common.convertMermaidToExcalidraw.mockResolvedValue({ success: true });

      renderComponent();

      const insertButton = screen.getByRole("button", { name: /insert/i });
      fireEvent.click(insertButton);

      await waitFor(() =>
        expect(common.convertMermaidToExcalidraw).toHaveBeenCalled(),
      );
      await waitFor(() => expect(common.insertToEditor).toHaveBeenCalled());
    });

    it("should not insert when conversion fails", async () => {
      const common = await import("./common");
      common.convertMermaidToExcalidraw.mockResolvedValue({ success: false });

      renderComponent();

      const insertButton = screen.getByRole("button", { name: /insert/i });
      fireEvent.click(insertButton);

      await waitFor(() =>
        expect(common.convertMermaidToExcalidraw).toHaveBeenCalled(),
      );
      expect(common.insertToEditor).not.toHaveBeenCalled();
    });
  });

  describe("handleAiRepairClick", () => {
    it("should not call onGenerate without content", async () => {
      mockChatHistory = {
        ...defaultChatHistory,
        messages: [
          defaultChatHistory.messages[0],
          defaultChatHistory.messages[1],
          {
            ...defaultChatHistory.messages[2],
            content: "",
          },
        ],
      };
      renderComponent();

      const repairButton = screen.getByRole("button", { name: /regenerate/i });
      fireEvent.click(repairButton);

      expect(onGenerateMock).not.toHaveBeenCalled();
    });

    it("should call onGenerate with repair prompt", async () => {
      renderComponent();

      const repairButton = screen.getByRole("button", { name: /regenerate/i });
      fireEvent.click(repairButton);

      expect(onGenerateMock).toHaveBeenCalled();
    });
  });

  describe("handleRetry", () => {
    it("should not execute when message is at index 0", async () => {
      mockChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "assistant-1",
            type: "assistant",
            content: "graph TD; A-->B",
            error: "network failure",
            errorType: "network",
            isGenerating: false,
            timestamp: new Date(),
          },
        ],
      };
      renderComponent();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onGenerateMock).not.toHaveBeenCalled();
    });

    it("should execute retry when previous message is user", async () => {
      mockChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "user-1",
            type: "user",
            content: "user prompt",
            timestamp: new Date(),
          },
          {
            id: "assistant-1",
            type: "assistant",
            content: "graph TD; A-->B",
            error: "network failure",
            errorType: "network",
            isGenerating: false,
            timestamp: new Date(),
          },
        ],
      };
      renderComponent();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(setLastRetryAttemptMock).toHaveBeenCalled();
      expect(onGenerateMock).toHaveBeenCalled();
    });
  });

  describe("handleDeleteMessage", () => {
    it("should remove messages when deleting assistant message", async () => {
      renderComponent();

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(setChatHistoryMock).toHaveBeenCalled();
    });

    it("should show delete for assistant messages", () => {
      renderComponent();

      const deleteButtons = screen.queryAllByRole("button", {
        name: /delete/i,
      });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe("handlePromptChange", () => {
    it("should update currentPrompt", async () => {
      renderComponent();

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "new prompt" } });

      expect(setChatHistoryMock).toHaveBeenCalled();
    });
  });

  describe("rendering", () => {
    it("should render preview when showPreview=true", () => {
      renderComponent();

      expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
    });

    it("should pass hideErrorDetails=true when errorType=parse", () => {
      renderComponent();

      expect(screen.getByText("hide-error")).toBeInTheDocument();
    });
  });
});
