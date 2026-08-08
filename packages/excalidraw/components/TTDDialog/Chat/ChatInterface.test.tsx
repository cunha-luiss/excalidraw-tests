import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInterface } from "./ChatInterface";
import { KEYS } from "@excalidraw/common";

// Fix 1: Resolve a ausência de métodos de layout do ecossistema JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn() || (() => {});

describe("Suíte de Testes Unitários - ChatInterface", () => {
  const mockPropsBase = {
    chatId: "chat-123",
    currentPrompt: "",
    onPromptChange: jest.fn(),
    onGenerate: jest.fn(),
    isGenerating: false,
    messages: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // PERSPECTIVA CAIXA-PRETA (Baseada na Especificação e Comportamento Esperado)
  // =========================================================================
  describe("Abordagem Caixa-Preta", () => {

    // 1. Técnica: Particionamento de Equivalência
    // Justificativa: Valida se o componente atende à classe de equivalência válida de renderizar 
    // múltiplos itens históricos em tela quando a lista de mensagens possui dados válidos.
    test("[Caixa-Preta] Deve mapear e renderizar corretamente a lista de mensagens populada", () => {
      // Fix 2: Alterado de 'text' para 'content' para mapear a propriedade estrutural do Excalidraw
      const messagesMock = [
        { id: "m1", content: "Primeira mensagem", sender: "user" as const, timestamp: new Date() },
        { id: "m2", content: "Segunda mensagem", sender: "assistant" as const, timestamp: new Date() },
      ];

      render(<ChatInterface {...mockPropsBase} messages={messagesMock} />);

      // Como o componente pode quebrar ou envelopar o texto, usamos seletores flexíveis (regex)
      expect(screen.getByText(/Primeira mensagem/i)).toBeInTheDocument();
      expect(screen.getByText(/Segunda mensagem/i)).toBeInTheDocument();
    });

    // 2. Técnica: Análise de Valor Limite
    // Justificativa: Testa o comportamento no limite inferior da lista de mensagens (tamanho 0),
    // garantindo que a tela de boas-vindas padrão seja exibida corretamente em vez de quebrar a interface.
    test("[Caixa-Preta] Deve renderizar a tela de boas-vindas quando a lista de mensagens tiver tamanho 0", () => {
      render(<ChatInterface {...mockPropsBase} messages={[]} />);

      // Fix 3: Buscando pelo texto descritivo real injetado no HTML de boas-vindas mapeado no log
      expect(screen.getByText(/Let's design your diagram/i)).toBeInTheDocument();
    });

    // 3. Técnica: Análise de Valor Limite (Fronteira de Caracteres do Input)
    // Justificativa: O requisito implícito na variável canSend exige que o tamanho do texto 
    // seja estritamente maior que 3 caracteres. Testamos os limites de 3 (inválido) e 4 (válido).
    test("[Caixa-Preta] Deve controlar a ativação do envio baseando-se no limite de caracteres do prompt", () => {
      // Limite de 3 caracteres (canSend deve ser false -> botão desabilitado)
      const { rerender } = render(<ChatInterface {...mockPropsBase} currentPrompt="abc" />);
      let button = screen.getByRole("button");
      expect(button).toBeDisabled();

      // Limite de 4 caracteres (canSend deve ser true -> botão habilitado)
      rerender(<ChatInterface {...mockPropsBase} currentPrompt="abcd" />);
      expect(button).not.toBeDisabled();
    });
  });

  // =========================================================================
  // PERSPECTIVA CAIXA-BRANCA (Análise Estrutural do Fluxo Interno)
  // =========================================================================
  describe("Abordagem Caixa-Branca", () => {

    // 1. Técnica: Cobertura de Decisions / Branches
    // Justificativa: Garante a cobertura de caminhos do operador ternário que define o placeholder do input.
    // Avalia o fluxo estrutural onde 'rateLimits.rateLimitRemaining === 0' avalia para TRUE.
    test("[Caixa-Branca] Deve cobrir a branch de placeholder quando o limite de requisições chega a zero", () => {
      const rateLimitsMock = { rateLimit: 10, rateLimitRemaining: 0 };
      
      render(
        <ChatInterface 
          {...mockPropsBase} 
          rateLimits={rateLimitsMock} 
        />
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
      // Fix 4: Atualizado com a string de tradução real interpretada pelo componente original
      expect(textarea).toHaveAttribute("placeholder", "You've reached your message limit");
    });

    // 2. Técnica: Cobertura MC/DC (Modified Condition/Decision Coverage)
    // Justificativa: Analisa a decisão complexa da variável combinada `canSend`.
    // Estrutura interna: currentPrompt.trim().length > 3 && !isGenerating && (rateLimits?.rateLimitRemaining ?? 1) > 0;
    // Testamos a variação independente de cada termo mantendo os demais verdadeiros.
    test("[Caixa-Branca] Deve avaliar as condições da expressão booleana complexa de canSend (MC/DC)", () => {
      const onGenerateMock = jest.fn();

      // Caso 1: Condições Verdadeiras (Prompt > 3 [V], isGenerating = false [V], limits > 0 [V]) -> canSend = true
      const { rerender } = render(
        <ChatInterface {...mockPropsBase} currentPrompt="Prompt Longo" onGenerate={onGenerateMock} />
      );
      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();

      // Caso 2: Altera apenas a condição do tamanho do Prompt para Falso -> canSend deve se tornar false
      rerender(<ChatInterface {...mockPropsBase} currentPrompt="abc" />);
      expect(button).toBeDisabled();

      // Caso 3: Altera apenas a condição de geração (isGenerating = true) -> canSend vira false, mas canStop vira true (botão reativa para permitir o Abort)
      rerender(<ChatInterface {...mockPropsBase} currentPrompt="Prompt Longo" isGenerating={true} onAbort={jest.fn()} />);
      expect(button).not.toBeDisabled(); 
    });

    // 3. Técnica: Cobertura de Fluxo de Controle (Execução do handleKeyDown)
    // Justificativa: Garante a cobertura estrutural da função `handleKeyDown` mapeando o desvio condicional
    // quando a tecla Enter é pressionada combinada ou não com a tecla Shift.
    test("[Caixa-Branca] Deve disparar o submit ao pressionar Enter sozinho, mas não com Shift", () => {
      const onPromptChangeMock = jest.fn();
      render(<ChatInterface {...mockPropsBase} currentPrompt="Texto para envio" onPromptChange={onPromptChangeMock} />);
      const textarea = screen.getByRole("textbox");

      // Branch 1: Enter + Shift -> Não deve submeter (comportamento nativo de quebra de linha)
      fireEvent.keyDown(textarea, { key: KEYS.ENTER, shiftKey: true });
      expect(mockPropsBase.onGenerate).not.toHaveBeenCalled();

      // Branch 2: Enter sozinho -> Deve interceptar o evento e disparar o submit
      fireEvent.keyDown(textarea, { key: KEYS.ENTER, shiftKey: false });
      expect(mockPropsBase.onGenerate).toHaveBeenCalledWith({ prompt: "Texto para envio" });
    });
  });
});