const vscode = require("vscode");

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

// 각 라인에 표시할 라벨 목록
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
  provideCodeLenses(document, token) {
    const codeLenses = [];
    const hexRegex = /^[0-9A-Fa-f]{6}$/i;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text.trim();
      if (token.isCancellationRequested) {
        return [];
      }
      if (hexRegex.test(text)) {
        const range = line.range;
        codeLenses.push(new vscode.CodeLens(range));
      }
    }
    return codeLenses;
  }

  resolveCodeLens(codeLens, token) {
    const line = codeLens.range.start.line;
    const label = lineLabels[line];
    if (token.isCancellationRequested) {
      return null;
    }
    if (label) {
      codeLens.command = {
        title: `$(clippy) ${line}: ${label}`,
        command: "pyxpal.copyLabel",
        arguments: [label],
        tooltip: `Copy "${label}" to clipboard`,
      };
    }
    return codeLens;
  }
}

function activate(context) {
  // 라벨 복사 커맨드 등록
  const copyCommand = vscode.commands.registerCommand(
    "pyxpal.copyLabel",
    (textToCopy) => {
      vscode.env.clipboard.writeText(textToCopy);
      vscode.window.showInformationMessage(`Copied: ${textToCopy}`);
    }
  );
  context.subscriptions.push(copyCommand);

  // 색상 코드 텍스트에서 색상 선택기를 제공하는 기능
  const hexRegex = /^[0-9A-Fa-f]{6}$/i;
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
  const codeLensProviderRegistration = vscode.languages.registerCodeLensProvider(
    { language: "pyxpal" },
    codeLensProvider
  );
  context.subscriptions.push(codeLensProviderRegistration);
}

function deactivate() {}

module.exports = { activate, deactivate };