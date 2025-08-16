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

const labelDecorationCache = new Map();

/**
 * 에디터의 색상 미리보기 장식을 업데이트합니다.
 * @param {vscode.TextEditor} editor
 */
function updateDecorations(editor) {
  if (!editor || editor.document.languageId !== "pyxpal") {
    return;
  }

  const hexRegex = /^[0-9A-Fa-f]{6}$/i;
  const labelDecorationsMap = new Map(); // Map<label, vscode.DecorationOptions[]>

  for (let i = 0; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i);
    const text = line.text.trim();

    if (hexRegex.test(text)) {
      const label = lineLabels[i];
      if (label) {
        if (!labelDecorationsMap.has(label)) {
          labelDecorationsMap.set(label, []);
        }

        // 복사 커맨드를 실행하는 마크다운 링크를 생성합니다.
        const args = [label];
        const commandUri = vscode.Uri.parse(
          `command:pyxpal.copyLabel?${encodeURIComponent(JSON.stringify(args))}`
        );
        const hoverMessage = new vscode.MarkdownString(
          `[Copy Label: **${label}**](${commandUri})`
        );
        hoverMessage.isTrusted = true; // 커맨드 실행을 위해 필요합니다.

        const options = {
          range: line.range,
          hoverMessage: hoverMessage,
        };
        labelDecorationsMap.get(label).push(options);
      }
    }
  }

  // 이전 장식들을 정리합니다.
  labelDecorationCache.forEach((d) => d.dispose());
  labelDecorationCache.clear();

  // 라벨 장식을 적용합니다.
  for (const [label, options] of labelDecorationsMap.entries()) {
    const decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        contentText: ` ${label}`,
        margin: "0 0 0 1em",
        color: new vscode.ThemeColor("editor.foreground"),
      },
    });
    editor.setDecorations(decorationType, options);
    labelDecorationCache.set(label, decorationType);
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

  // --- 오른쪽 끝에 라벨을 표시하는 장식 기능 ---

  let activeEditor = vscode.window.activeTextEditor;
  let timeout = undefined;

  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    timeout = setTimeout(() => updateDecorations(activeEditor), 250);
  }

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );
}

function deactivate() {
  // 캐시된 모든 장식을 정리합니다.
  labelDecorationCache.forEach((decoration) => decoration.dispose());
  labelDecorationCache.clear();
}

module.exports = { activate, deactivate };
