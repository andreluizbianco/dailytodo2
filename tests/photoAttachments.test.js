const assert = require("node:assert/strict");
const fs = require("node:fs");
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

const {
  appendPhotoAttachment,
  removePhotoAttachment,
} = require(path.join(__dirname, "..", "utils", "photoAttachments.ts"));

const note = { id: 7, text: "Photo note", attachments: undefined };
const first = appendPhotoAttachment(note, {
  id: "photo-1",
  uri: "file:///image-1.jpg",
  name: "image-1.jpg",
  createdAt: "2026-06-05T10:00:00.000Z",
});
const second = appendPhotoAttachment(first, {
  id: "photo-2",
  uri: "file:///image-2.jpg",
  name: "image-2.jpg",
  createdAt: "2026-06-05T10:05:00.000Z",
});

assert.deepEqual(
  second.attachments.map((attachment) => attachment.id),
  ["photo-1", "photo-2"],
);

const removed = removePhotoAttachment(second, "photo-1");

assert.deepEqual(
  removed.attachments.map((attachment) => attachment.id),
  ["photo-2"],
);
assert.equal(removed.attachments[0].type, "image");

console.log("photo attachment tests passed");
