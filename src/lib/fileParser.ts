import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function parseFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return parseTextFile(file);
  } else if (
    fileType === 'application/pdf' ||
    fileName.endsWith('.pdf')
  ) {
    return parsePdfFile(file);
  } else if (
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.csv')
  ) {
    return parseExcelFile(file);
  } else if (
    fileType === 'application/msword' ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.doc') ||
    fileName.endsWith('.docx')
  ) {
    return parseWordFile(file);
  } else if (
    fileType === 'message/rfc822' ||
    fileName.endsWith('.eml') ||
    fileName.endsWith('.msg')
  ) {
    return parseEmailFile(file);
  } else {
    throw new Error(`Unsupported file type: ${fileType || 'unknown'}. Please upload a PDF, Word, Excel, or Outlook Email file.`);
  }
}

async function parseTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read text file'));
    };
    reader.readAsText(file);
  });
}

async function parsePdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    // Limit to first 5 pages for quote content (technical drawings/specs beyond that aren't useful)
    const maxPages = Math.min(pdf.numPages, 5);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      if (textContent.items.length === 0) continue;

      // Build structured text preserving line breaks based on Y-position
      // This is critical for AI to understand table structures (Item | Qty | Price)
      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items as any[]) {
        const currentY = item.transform ? item.transform[5] : null;

        if (currentY !== null && lastY !== null && Math.abs(currentY - lastY) > 2) {
          // Y position changed significantly — this is a new line
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          // Same line, add a space separator between text chunks
          pageText += ' ';
        }

        pageText += item.str;
        lastY = currentY;
      }

      fullText += `--- Page ${pageNum} ---\n${pageText.trim()}\n\n`;
    }

    const result = fullText.trim();

    if (!result || result.length < 20) {
      throw new Error('PDF appears to contain no readable text. It may be a scanned image — please try copying and pasting the quote text directly.');
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseExcelFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let fullText = '';

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_csv(worksheet);
      fullText += `Sheet: ${sheetName}\n${sheetData}\n\n`;
    });

    return fullText.trim();
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseWordFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // For .docx files (which are ZIP archives with XML content)
    if (file.name.toLowerCase().endsWith('.docx')) {
      // Use XLSX library to extract text from the ZIP structure
      const workbook = XLSX.read(uint8Array, { type: 'array', bookVBA: true });

      // Try to extract any readable content
      let text = '';
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_csv(worksheet) + '\n';
      });

      if (text.trim()) {
        return text.trim();
      }
    }

    // Fallback: Try to read as text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(uint8Array);

    // Clean up binary artifacts and extract readable text
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();

    if (text.length > 100) {
      return text;
    }

    throw new Error('Unable to extract text from Word document. Please try copying the content and pasting it directly.');
  } catch (error) {
    throw new Error(`Failed to parse Word file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the content and pasting it directly.`);
  }
}

async function parseEmailFile(file: File): Promise<string> {
  try {
    // Email files (.eml, .msg) are typically text-based or have text content
    const text = await parseTextFile(file);

    // Clean up email headers and format
    const lines = text.split('\n');
    let inBody = false;
    let bodyText = '';

    for (const line of lines) {
      // Look for common email body separators
      if (line.trim() === '' && !inBody) {
        inBody = true;
        continue;
      }

      if (inBody) {
        bodyText += line + '\n';
      }
    }

    // If we found a body, return it, otherwise return the full text
    return bodyText.trim() || text.trim();
  } catch (error) {
    throw new Error(`Failed to parse email file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the email content and pasting it directly.`);
  }
}
