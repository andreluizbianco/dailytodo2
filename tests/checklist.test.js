const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const checklist = require(path.join(
  __dirname,
  "..",
  "utils",
  "checklist.ts",
));

const {
  addChecklistItem,
  applyPlainTextToListState,
  normalizeNoteForType,
  parseBulletNote,
  parseChecklistNote,
  removeChecklistItem,
  reorderBulletItem,
  reorderChecklistItem,
  serializeBulletItems,
  serializeChecklistItems,
  splitBulletItem,
  splitChecklistItem,
  stripListSyntaxForText,
  toggleChecklistItem,
  updateBulletItemText,
  updateChecklistItemText,
} = checklist;

assert.deepEqual(parseChecklistNote("[ ] Buy milk\n[x] Call Ana\n- [ ] From bullet\n- [x] Done bullet\nLoose line"), [
  { checked: false, text: "Buy milk" },
  { checked: true, text: "Call Ana" },
  { checked: false, text: "From bullet" },
  { checked: true, text: "Done bullet" },
  { checked: false, text: "Loose line" },
]);

assert.equal(
  serializeChecklistItems([
    { checked: false, text: "Buy milk" },
    { checked: true, text: "Call Ana" },
  ]),
  "[ ] Buy milk\n[x] Call Ana",
);

assert.deepEqual(toggleChecklistItem(parseChecklistNote("[ ] A\n[ ] B"), 0), [
  { checked: false, text: "B" },
  { checked: true, text: "A" },
]);

assert.deepEqual(addChecklistItem(parseChecklistNote("[ ] A\n[x] B"), "C"), [
  { checked: false, text: "A" },
  { checked: false, text: "C" },
  { checked: true, text: "B" },
]);

assert.deepEqual(
  reorderChecklistItem(parseChecklistNote("[ ] A\n[ ] B\n[x] C"), 1, 0),
  [
    { checked: false, text: "B" },
    { checked: false, text: "A" },
    { checked: true, text: "C" },
  ],
);

assert.deepEqual(updateChecklistItemText(parseChecklistNote("[ ] A"), 0, "AA"), [
  { checked: false, text: "AA" },
]);

assert.deepEqual(splitChecklistItem(parseChecklistNote("[ ] Alpha"), 0, "Al"), [
  { checked: false, text: "Al" },
  { checked: false, text: "pha" },
]);

assert.deepEqual(removeChecklistItem(parseChecklistNote("[ ] A\n[ ] \n[x] C"), 1), [
  { checked: false, text: "A" },
  { checked: true, text: "C" },
]);

assert.deepEqual(parseBulletNote("- Alpha\n• Beta\n[ ] Box\n[x] Done\n- [ ] Hybrid\n- [x] Hybrid done\nLoose line"), [
  { checked: false, text: "Alpha" },
  { checked: false, text: "Beta" },
  { checked: false, text: "Box" },
  { checked: true, text: "Done" },
  { checked: false, text: "Hybrid" },
  { checked: true, text: "Hybrid done" },
  { checked: false, text: "Loose line" },
]);

assert.equal(
  serializeBulletItems([{ text: "Alpha" }, { text: "Beta" }]),
  "- Alpha\n- Beta",
);

assert.deepEqual(updateBulletItemText(parseBulletNote("- A"), 0, "AA"), [
  { checked: false, text: "AA" },
]);

assert.deepEqual(splitBulletItem(parseBulletNote("- Alpha"), 0, "Al"), [
  { checked: false, text: "Al" },
  { checked: false, text: "pha" },
]);

assert.deepEqual(reorderBulletItem(parseBulletNote("- A\n- B\n- C"), 2, 0), [
  { checked: false, text: "C" },
  { checked: false, text: "A" },
  { checked: false, text: "B" },
]);

assert.equal(
  stripListSyntaxForText("[ ] Buy milk\n[x] Done\n- [ ] Hybrid\n- Bullet\nPlain"),
  "Buy milk\nDone\nHybrid\nBullet\nPlain",
);

assert.equal(
  normalizeNoteForType("[ ] Buy\n[x] Done\n- [ ] Hybrid", "bullet"),
  "[ ] Buy\n[x] Done\n[ ] Hybrid",
);

assert.equal(
  normalizeNoteForType("- Buy\n- Done\nPlain", "checkbox"),
  "[ ] Buy\n[ ] Done\n[ ] Plain",
);

assert.equal(
  normalizeNoteForType("- [ ] Hybrid\n[x] Done", "text"),
  "[ ] Hybrid\n[x] Done",
);

assert.equal(
  applyPlainTextToListState("[x] Done\n[ ] Open", "Done edited\nOpen"),
  "[x] Done edited\n[ ] Open",
);

assert.equal(
  applyPlainTextToListState("[x] Done", "Done\nNew"),
  "[x] Done\n[ ] New",
);

console.log("checklist helper tests passed");
