const vscode = require("vscode");

function activate(context) {
  const hexRegex = /^[0-9A-Fa-f]{6}$/; // # 없이 6자리 HEX

  function updateDecorations(editor) {
    if (!editor || editor.document.languageId !== "pyxpal") return;

    const decorations = [];
    const decorationType = vscode.window.createTextEditorDecorationType({});

    for (let i = 0; i < editor.document.lineCount; i++) {
      const text = editor.document.lineAt(i).text.trim();
      if (hexRegex.test(text)) {
        const color = `#${text}`;
        const deco = vscode.window.createTextEditorDecorationType({
          before: {
            contentText: " ",
            backgroundColor: color,
            margin: "0 6px 0 0",
            width: "16px",
            height: "16px",
          },
        });
        decorations.push({ type: deco, range: new vscode.Range(i, 0, i, 0) });
      }
    }

    // 이전 장식 지우기
    if (context.subscriptions._decorationInstances) {
      context.subscriptions._decorationInstances.forEach((d) => d.dispose());
    }
    context.subscriptions._decorationInstances = [];

    // 새 장식 적용
    decorations.forEach(({ type, range }) => {
      editor.setDecorations(type, [range]);
      context.subscriptions._decorationInstances.push(type);
    });
  }

  vscode.window.onDidChangeActiveTextEditor(
    updateDecorations,
    null,
    context.subscriptions
  );
  vscode.workspace.onDidChangeTextDocument(
    (e) => {
      if (
        vscode.window.activeTextEditor &&
        e.document === vscode.window.activeTextEditor.document
      ) {
        updateDecorations(vscode.window.activeTextEditor);
      }
    },
    null,
    context.subscriptions
  );

  updateDecorations(vscode.window.activeTextEditor);
}

function deactivate() {}

module.exports = { activate, deactivate };
