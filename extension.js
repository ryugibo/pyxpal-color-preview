const vscode = require("vscode");
const nls = require("vscode-nls");
const fs = require("fs");
const path = require("path");

const localize = nls.loadMessageBundle();

/**
 * 6자리 HEX 문자열을 vscode.Color 객체로 파싱합니다.
 * @param {string} hex 6자리 HEX 문자열 (예: "RRGGBB")
 * @returns {vscode.Color}
 */
function parseHexColor(hex) {
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return new vscode.Color(r, g, b, 1);
}

/**
 * vscode.Color 객체를 '#' 없는 6자리 HEX 문자열로 변환합니다.
 * @param {vscode.Color} color
 * @returns {string} 6자리 HEX 문자열 (예: "RRGGBB")
 */
function toHexColor(color) {
  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);

  const toHex = (c) => c.toString(16).padStart(2, "0").toUpperCase();

  return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 주어진 pyxpal 문서와 같은 디렉토리에 있는 .py 파일에서 COLOR_ 상수를 읽어옵니다.
 * @param {vscode.Uri} documentUri 현재 pyxpal 문서의 URI
 * @returns {Map<number, string>} 상수 값(int)을 키로, 상수 이름(string)을 값으로 하는 맵
 */
async function getPythonConstants(documentUri) {
  const constants = new Map();
  const pyxpalFilePath = documentUri.fsPath;
  const pyxpalDir = path.dirname(pyxpalFilePath);
  const pyxpalBasename = path.basename(pyxpalFilePath, ".pyxpal");
  const pyFileName = pyxpalBasename + ".py";
  const pyFilePath = path.join(pyxpalDir, pyFileName);

  console.log(`[Pyxpal Extension] pyxpalFilePath: ${pyxpalFilePath}`);
  console.log(`[Pyxpal Extension] pyxpalDir: ${pyxpalDir}`);
  console.log(`[Pyxpal Extension] pyFileName: ${pyFileName}`);
  console.log(`[Pyxpal Extension] pyFilePath: ${pyFilePath}`);

  try {
    const fileContent = await fs.promises.readFile(pyFilePath, "utf8");
    // COLOR_로 시작하고 int 타입이며 값이 할당된 상수를 찾습니다.
    const regex = /^COLOR_([A-Z_]+):\s*int\s*=\s*(\d+)$/gm;
    let match;
    while ((match = regex.exec(fileContent)) !== null) {
      const constantName = `${pyxpalBasename}.COLOR_${match[1]}`; // pyxel.COLOR_ 접두사 추가
      const constantValue = parseInt(match[2], 10);
      if (!isNaN(constantValue)) {
        constants.set(constantValue, constantName);
      }
    }
  } catch (error) {
    // 파일이 없거나 읽을 수 없는 경우 무시
    console.error(
      `[Pyxpal Extension] Failed to read or parse Python file: ${pyFilePath}`,
      error
    ); // Log full error object
  }
  return constants;
}

// 각 라인에 표시할 라벨 목록 (Python 파일이 없을 경우 대체)
const lineLabels = [
  "pyxel.COLOR_BLACK",
  "pyxel.COLOR_NAVY",
  "pyxel.COLOR_PURPLE",
  "pyxel.COLOR_GREEN",
  "pyxel.COLOR_BROWN",
  "pyxel.COLOR_DARK_BLUE",
  "pyxel.COLOR_LIGHT_BLUE",
  "pyxel.COLOR_WHITE",
  "pyxel.COLOR_RED",
  "pyxel.COLOR_ORANGE",
  "pyxel.COLOR_YELLOW",
  "pyxel.COLOR_LIME",
  "pyxel.COLOR_CYAN",
  "pyxel.COLOR_GRAY",
  "pyxel.COLOR_PINK",
  "pyxel.COLOR_PEACH",
];

/**
 * Pyxpal 파일에 대한 CodeLens를 제공합니다.
 * 각 색상 라인 위에 복사 버튼을 추가합니다.
 */
class PyxpalCodeLensProvider {
  async provideCodeLenses(document, token) {
    // Make it async
    const codeLenses = [];
    const hexRegex = /^[0-9A-Fa-f]{6}$/i;

    // Python 파일에서 상수들을 동적으로 로드
    const pythonConstants = await getPythonConstants(document.uri);

    for (let i = 0; i < document.lineCount; i++) {
      if (token.isCancellationRequested) {
        return [];
      }
      const line = document.lineAt(i);
      const text = line.text.trim();

      if (hexRegex.test(text)) {
        const range = line.range;
        // 라인 인덱스에 해당하는 상수를 찾습니다.
        // Python 파일에서 상수를 찾지 못했거나 Python 파일이 없는 경우, 기존 lineLabels를 사용합니다.
        const label =
          pythonConstants.size > 0 ? pythonConstants.get(i) : lineLabels[i];

        // Lens for the number (always present for a valid hex line)
        const numStr = i.toString();
        const numLens = new vscode.CodeLens(range, {
          title: `$(symbol-numeric) ${numStr}`,
          command: "pyxpal.copyLabel",
          arguments: [numStr],
          tooltip: `Copy index ${numStr}`,
        });
        codeLenses.push(numLens);

        // Lens for the label (only for lines < 16)
        if (label) {
          const labelLens = new vscode.CodeLens(range, {
            title: `$(symbol-enum-member) ${label}`,
            command: "pyxpal.copyLabel",
            arguments: [label],
            tooltip: `Copy "${label}"`,
          });
          codeLenses.push(labelLens);
        }
      }
    }
    return codeLenses;
  }

  resolveCodeLens(codeLens, token) {
    // All commands are created in provideCodeLenses, so this is no longer needed.
    return codeLens;
  }
}

function activate(context) {
  // 라벨 복사 커맨드 등록
  const copyCommand = vscode.commands.registerCommand(
    "pyxpal.copyLabel",
    async (textToCopy) => { // Make the callback async
      console.log(`[Pyxpal Extension] pyxpal.copyLabel command executed.`);
      console.log(`[Pyxpal Extension] textToCopy: ${textToCopy}`);
      try {
        await vscode.env.clipboard.writeText(textToCopy);
        vscode.window.showInformationMessage(
          localize("Copied", "Copied: {0}", textToCopy)
        );
      } catch (error) {
        console.error(`[Pyxpal Extension] Failed to copy to clipboard:`, error);
        vscode.window.showErrorMessage(
          localize("CopyFailed", "Failed to copy: {0}", error.message)
        );
      }
    }
  );
  context.subscriptions.push(copyCommand);

  const hexRegex = /^[0-9A-Fa-f]{6}$/i;

  // 색상 코드 텍스트에서 색상 선택기를 제공하는 기능
  const colorProvider = {
    provideDocumentColors(document, token) {
      const colors = [];
      for (let i = 0; i < document.lineCount; i++) {
        if (token.isCancellationRequested) return [];

        const line = document.lineAt(i);
        const text = line.text.trim();

        if (hexRegex.test(text)) {
          const color = parseHexColor(text);
          const start = line.firstNonWhitespaceCharacterIndex;
          const end = start + text.length;
          const range = new vscode.Range(i, start, i, end);
          colors.push(new vscode.ColorInformation(range, color));
        }
      }
      return colors;
    },
    provideColorPresentations(color, context, token) {
      const hexLabel = toHexColor(color);
      const presentation = new vscode.ColorPresentation(hexLabel);
      presentation.textEdit = new vscode.TextEdit(context.range, hexLabel);
      return [presentation];
    },
  };

  const providerRegistration = vscode.languages.registerColorProvider(
    { language: "pyxpal" },
    colorProvider
  );
  context.subscriptions.push(providerRegistration);

  // CodeLens 공급자 등록
  const codeLensProvider = new PyxpalCodeLensProvider();
  const codeLensProviderRegistration =
    vscode.languages.registerCodeLensProvider(
      { language: "pyxpal" },
      codeLensProvider
    );
  context.subscriptions.push(codeLensProviderRegistration);

  // --- Diagnostics for inactive lines ---
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("pyxpal");
  context.subscriptions.push(diagnosticCollection);

  function updateDiagnostics(document) {
    if (document && document.languageId === "pyxpal") {
      const diagnostics = [];
      // Find the last line with content.
      let lastNonEmptyLine = -1;
      for (let i = document.lineCount - 1; i >= 0; i--) {
        if (document.lineAt(i).text.trim().length > 0) {
          lastNonEmptyLine = i;
          break;
        }
      }

      for (let lineIndex = 0; lineIndex <= lastNonEmptyLine; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();

        if (!hexRegex.test(text)) {
          const range = new vscode.Range(
            lineIndex,
            0,
            lineIndex,
            line.range.end.character
          );
          const message = localize(
            "invalid_hex_code",
            "Meaningless data: Not a valid 6-digit HEX code."
          );
          const diagnostic = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostics.push(diagnostic);
        }
      }
      diagnosticCollection.set(document.uri, diagnostics);
    }
  }

  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) =>
      updateDiagnostics(event.document)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticCollection.delete(doc.uri)
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
