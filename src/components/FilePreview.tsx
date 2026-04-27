import { FileText, FileSpreadsheet, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface FilePreviewProps {
  file: File | null;
  fileContent: string;
  onRemove: () => void;
}

export function FilePreview({ file, fileContent, onRemove }: FilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (file?.type === 'application/pdf') {
      void renderPdfPreview();
    }
  }, [file]);

  const renderPdfPreview = async () => {
    if (!file || !canvasRef.current) return;

    try {
      const pdfjsLib = await import('pdfjs-dist');
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page
        .render({
          canvas,
          canvasContext: context,
          viewport,
        })
        .promise;
    } catch (error) {
      console.error('Error rendering PDF preview:', error);
    }
  };

  if (!file && !fileContent) return null;

  const getFileIcon = () => {
    if (!file) return <FileText className="w-8 h-8 text-gray-400" />;

    if (file.type === 'application/pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }

    if (
      file.type.includes('spreadsheet') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv')
    ) {
      return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
    }

    return <FileText className="w-8 h-8 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          {getFileIcon()}
          <div>
            <p className="font-medium text-gray-800">{file ? file.name : 'Pasted Content'}</p>
            {file && <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 hover:bg-white rounded-lg transition-colors"
          title="Remove file"
          type="button"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="p-4">
        {file?.type === 'application/pdf' ? (
          <div className="max-h-96 overflow-auto bg-gray-50 rounded-lg p-4">
            <canvas ref={canvasRef} className="max-w-full h-auto" />
          </div>
        ) : (
          <div className="max-h-96 overflow-auto bg-gray-50 rounded-lg p-4">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {fileContent.slice(0, 2000)}
              {fileContent.length > 2000 && (
                <span className="text-gray-500 italic">
                  ... ({fileContent.length - 2000} more characters)
                </span>
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
