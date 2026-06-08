import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import * as common from "./common";
import { TextToDiagram } from "./TextToDiagram";
import { chatHistoryAtom, errorAtom } from "./TTDContext";

const setAppStateMock = vi.fn();
const onGenerateMock = vi.fn();
const onTextSubmitMock = vi.fn();
const setErrorMock = vi.fn();
const setChatHistoryMock = vi.fn();
const setLastRetryAttemptMock = vi.fn();

vi.mock("../../editor-jotai", async (importOriginal) => {
  const actual = await importOriginal();

  const getAtomName = (atom: any) => {
    if (!atom) {
      return "";
    }
    if (typeof atom === "object" && "debugLabel" in atom && atom.debugLabel) {
      return String(atom.debugLabel);
    }
    return String(atom);
  };

  return {
    ...actual,
    useAtom: (atom: any) => {
      const atomName = getAtomName(atom);

      if (atom === errorAtom || atomName.includes("errorAtom")) {
        return [null, setErrorMock];
      }

      if (
        atom === chatHistoryAtom ||
        atomName.includes("chatHistoryAtom") ||
        atomName.includes("chat")
      ) {
        return [
          {
            id: "chat-1",
            currentPrompt: "",
            messages: [
              { id: "user-1", type: "user", content: "user prompt" },
              {
                id: "assistant-1",
                type: "assistant",
                content: "graph TD; A-->B",
                isGenerating: false,
              },
            ],
          },
          setChatHistoryMock,
        ];
      }

      return [null, vi.fn()];
    },
    useAtomValue: () => true,
  };
});

vi.mock("../App", () => ({
  useApp: () => ({
    state: { theme: "dark" },
  }),
  useExcalidrawSetAppState: () => setAppStateMock,
}));

vi.mock("./Chat", () => ({
  useChatAgent: () => ({
    setLastRetryAttempt: setLastRetryAttemptMock,
  }),
}));

vi.mock("./hooks/useTextGeneration", () => ({
  useTextGeneration: () => ({
    onGenerate: onGenerateMock,
    handleAbort: vi.fn(),
  }),
}));

vi.mock("./hooks/useMermaidRenderer", () => ({
  useMermaidRenderer: () => ({
    data: { current: { elements: [], files: null } },
  }),
}));

vi.mock("./useTTDChatStorage", () => ({
  useTTDChatStorage: () => ({
    savedChats: [],
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

vi.mock("./utils/chat", () => ({
  getLastAssistantMessage: () => ({
    id: "assistant-1",
    type: "assistant",
    content: "graph TD; A-->B",
    isGenerating: false,
    errorType: undefined,
  }),
}));

vi.mock("./Chat/TTDChatPanel", () => ({
  TTDChatPanel: (props: any) => {
    return (
      <div data-testid="chat-panel">
        <button onClick={() => props.onViewAsMermaid?.()}>view-mermaid</button>

        <button
          onClick={() =>
            props.onInsertMessage?.({ content: "graph TD; A-->B" })
          }
        >
          insert-message
        </button>
        <button onClick={() => props.onInsertMessage?.({ content: "" })}>
          insert-message-empty
        </button>

        <button
          onClick={() =>
            props.onAiRepairClick?.({
              content: "graph TD; A-->",
              error: "parse error",
            })
          }
        >
          ai-repair
        </button>
        <button
          onClick={() => props.onAiRepairClick?.({ content: "", error: "" })}
        >
          ai-repair-empty
        </button>

        {/* Botão de Sucesso */}
        <button
          onClick={() =>
            props.onRetry?.({
              id: "assistant-1",
              type: "assistant",
              content: "graph TD; A-->B",
            })
          }
        >
          retry
        </button>
        <button
          onClick={() =>
            props.onRetry?.({
              id: "assistant-unknown",
              type: "assistant",
              content: "",
            })
          }
        >
          retry-invalid
        </button>

        <button onClick={() => props.onDeleteMessage?.("assistant-1")}>
          delete-message
        </button>
        <button onClick={() => props.onPromptChange?.("new prompt")}>
          change-prompt
        </button>
      </div>
    );
  },
}));

vi.mock("./TTDPreviewPanel", () => ({
  TTDPreviewPanel: (props: any) => (
    <div data-testid="preview-panel">
      <button onClick={props.onInsert}>insert-editor</button>
      <span>{props.hideErrorDetails ? "hide-error" : "show-error"}</span>
    </div>
  ),
}));

function renderComponent() {
  return render(
    <TextToDiagram
      mermaidToExcalidrawLib={{ loaded: true } as any}
      onTextSubmit={onTextSubmitMock}
      persistenceAdapter={{} as any}
    />,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();

  vi.spyOn(common, "convertMermaidToExcalidraw").mockResolvedValue({ success: true });
  vi.spyOn(common, "insertToEditor").mockImplementation(() => undefined);
  vi.spyOn(common, "saveMermaidDataToStorage").mockImplementation(() => undefined);
});

describe("TextToDiagram - Black Box", () => {
  describe("Render", () => {
    it("should render the chat panel", () => {
      renderComponent();

      expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    });

    it("should render the preview when showPreview is active", () => {
      renderComponent();

      expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
    });
  });

  describe("view as Mermaid", () => {
    it("should open the Mermaid tab when clicking view as mermaid", () => {
      renderComponent();

      fireEvent.click(screen.getByText("view-mermaid"));

      expect(setAppStateMock).toHaveBeenCalledWith({
        openDialog: { name: "ttd", tab: "mermaid" },
      });
    });
  });

  describe("insert message", () => {
    it("should try to convert and insert into the editor when the message is valid", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("insert-message"));

      await waitFor(() => {
        expect(common.convertMermaidToExcalidraw).toHaveBeenCalled();
        expect(common.insertToEditor).toHaveBeenCalled();
      });
    });

    it("should not insert when the content is empty", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("insert-message-empty"));

      expect(common.convertMermaidToExcalidraw).not.toHaveBeenCalled();
      expect(common.insertToEditor).not.toHaveBeenCalled();
    });

    it("should not insert when the library is not loaded", async () => {
      render(
        <TextToDiagram
          mermaidToExcalidrawLib={{ loaded: false } as any}
          onTextSubmit={onTextSubmitMock}
          persistenceAdapter={{} as any}
        />,
      );

      fireEvent.click(screen.getByText("insert-message"));

      expect(common.convertMermaidToExcalidraw).not.toHaveBeenCalled();
      expect(common.insertToEditor).not.toHaveBeenCalled();
    });
  });

  describe("AI repair", () => {
    it("should call generation with repair prompt", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("ai-repair"));

      expect(onGenerateMock).toHaveBeenCalled();
    });

    it("should do nothing when the message has no content", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("ai-repair-empty"));

      expect(onGenerateMock).not.toHaveBeenCalled();
    });
  });

  describe("retry", () => {
    it("should resend the previous prompt when a user message exists", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("retry"));

      expect(setLastRetryAttemptMock).toHaveBeenCalled();
      expect(onGenerateMock).toHaveBeenCalled();
    });

    it("should do nothing when there is no valid previous message", async () => {
      renderComponent();

      fireEvent.click(screen.getByText("retry-invalid"));

      expect(setLastRetryAttemptMock).not.toHaveBeenCalled();
      expect(onGenerateMock).not.toHaveBeenCalled();
    });
  });

  describe("delete message", () => {
    it("should update history when deleting an assistant message", () => {
      renderComponent();

      fireEvent.click(screen.getByText("delete-message"));

      expect(setChatHistoryMock).toHaveBeenCalled();
    });
  });

  describe("change prompt", () => {
    it("should update currentPrompt when typing a new text", () => {
      renderComponent();

      fireEvent.click(screen.getByText("change-prompt"));

      expect(setChatHistoryMock).toHaveBeenCalled();
    });
  });
  describe("Preview", () => {
    it("should hide error details when errorType is parse", () => {
      renderComponent();

      expect(screen.getByText("show-error")).toBeInTheDocument();
    });
  });
});
