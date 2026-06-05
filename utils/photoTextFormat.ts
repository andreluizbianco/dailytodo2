import { PhotoScanFormat } from "../types";

export interface PhotoScanBlock {
  text: string;
  lines?: string[];
}

export interface PhotoScanResult {
  text: string;
  blocks?: PhotoScanBlock[];
}

const cleanLine = (line: string) => line.replace(/\s+/g, " ").trim();

const joinParagraphLines = (lines: string[]) =>
  lines.map(cleanLine).filter(Boolean).join(" ");

export const formatPhotoScanText = (
  result: PhotoScanResult | string,
  format: PhotoScanFormat,
) => {
  const scanResult: PhotoScanResult =
    typeof result === "string" ? { text: result } : result;

  const blocks =
    scanResult.blocks && scanResult.blocks.length > 0
      ? scanResult.blocks
      : scanResult.text
          .split(/\n{2,}/)
          .map((blockText) => ({
            text: blockText,
            lines: blockText.split("\n"),
          }));

  if (format === "compact") {
    return blocks
      .flatMap((block) => block.lines ?? block.text.split("\n"))
      .map(cleanLine)
      .filter(Boolean)
      .join(" ");
  }

  if (format === "paragraph") {
    return blocks
      .map((block) => joinParagraphLines(block.lines ?? block.text.split("\n")))
      .filter(Boolean)
      .join("\n\n");
  }

  return blocks
    .map((block) =>
      (block.lines ?? block.text.split("\n")).map(cleanLine).filter(Boolean).join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
};
