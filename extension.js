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

  const toHex = (c) => c.toString(16).padStart(2, "0");

  return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function activate(context) {
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
}

function deactivate() {}

module.exports = { activate, deactivate };
