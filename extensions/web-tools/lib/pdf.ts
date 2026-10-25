import { extractText, getDocumentProxy } from "unpdf";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

export function isPdf(bytes: Uint8Array, contentType: string): boolean {
  return /application\/pdf/i.test(contentType) || PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}

/** Extract plain text from a PDF, pages joined by blank lines. */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    return text
      .map((page) => page.replace(/[ \t]+/g, " ").trim())
      .filter((page) => page.length > 0)
      .join("\n\n");
  } catch (err) {
    throw new Error(`Could not read PDF: ${(err as Error).message}`);
  }
}
