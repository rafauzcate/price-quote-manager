import * as pdfjsLib from 'pdfjs-dist';
import { Workbook } from 'exceljs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

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
  }

  throw new Error(`Unsupported file type: ${fileType || 'unknown'}. Please upload a PDF, Word, Excel, or Outlook Email file.`);
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
    const maxPages = Math.min(pdf.numPages, 5);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      if (textContent.items.length === 0) continue;

      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items as any[]) {
        const currentY = item.transform ? item.transform[5] : null;

        if (currentY !== null && lastY !== null && Math.abs(currentY - lastY) > 2) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
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
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      return parseTextFile(file);
    }

    if (fileName.endsWith('.xls')) {
      throw new Error('Legacy .xls files are not supported for security reasons. Please convert to .xlsx or .csv and upload again.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new Workbook();
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

    let fullText = '';

    workbook.eachSheet((worksheet) => {
      const lines: string[] = [];

      worksheet.eachRow((row) => {
        const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        const serializedRow = rowValues
          .map((value) => normalizeCellValue(value))
          .join(',')
          .trim();

        if (serializedRow) {
          lines.push(serializedRow);
        }
      });

      if (lines.length > 0) {
        fullText += `Sheet: ${worksheet.name}\n${lines.join('\n')}\n\n`;
      }
    });

    const result = fullText.trim();
    if (!result) {
      throw new Error('Spreadsheet appears empty or unreadable.');
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseWordFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(uint8Array);

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
    const text = await parseTextFile(file);

    const lines = text.split('\n');
    let inBody = false;
    let bodyText = '';

    for (const line of lines) {
      if (line.trim() === '' && !inBody) {
        inBody = true;
        continue;
      }

      if (inBody) {
        bodyText += `${line}\n`;
      }
    }

    return bodyText.trim() || text.trim();
  } catch (error) {
    throw new Error(`Failed to parse email file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the email content and pasting it directly.`);
  }
}
