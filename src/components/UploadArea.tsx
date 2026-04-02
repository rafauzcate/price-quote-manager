import { useState, useEffect } from 'react';
import { Upload, Loader } from 'lucide-react';
import { parseFile } from '../lib/fileParser';
import { FilePreview } from './FilePreview';

interface ReferenceOption {
  name: string;
  number: string;
}

interface UploadAreaProps {
  onProcessQuote: (data: { fileContent: string; referenceName: string; referenceNumber: string; file?: File; fileName?: string; fileHash?: string }) => Promise<void>;
  existingReferences?: ReferenceOption[];
}

export function UploadArea({ onProcessQuote, existingReferences = [] }: UploadAreaProps) {
  const [fileContent, setFileContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [referenceName, setReferenceName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showNumberSuggestions, setShowNumberSuggestions] = useState(false);
  const [filteredNames, setFilteredNames] = useState<ReferenceOption[]>([]);
  const [filteredNumbers, setFilteredNumbers] = useState<ReferenceOption[]>([]);

  const handleFile = async (file: File) => {
    setFileError(null);
    setIsReadingFile(true);
    try {
      const text = await parseFile(file);
      setFileContent(text);
      setUploadedFile(file);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to read file';
      setFileError(errorMessage);
      setUploadedFile(null);
      console.error('Error parsing file:', error);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    setFileContent(pastedText);
    setUploadedFile(null);
  };

  const handleRemoveFile = () => {
    setFileContent('');
    setUploadedFile(null);
    setFileError(null);
  };

  useEffect(() => {
    if (referenceName) {
      const uniqueMap = new Map<string, ReferenceOption>();
      existingReferences.forEach(ref => {
        const key = `${ref.name.toLowerCase()}-${ref.number.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, ref);
        }
      });
      const uniqueRefs = Array.from(uniqueMap.values());
      const filtered = uniqueRefs.filter(ref =>
        ref.name.toLowerCase().includes(referenceName.toLowerCase())
      );
      setFilteredNames(filtered);
    } else {
      setFilteredNames([]);
    }
  }, [referenceName, existingReferences]);

  useEffect(() => {
    if (referenceNumber) {
      const uniqueMap = new Map<string, ReferenceOption>();
      existingReferences.forEach(ref => {
        const key = `${ref.name.toLowerCase()}-${ref.number.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, ref);
        }
      });
      const uniqueRefs = Array.from(uniqueMap.values());
      const filtered = uniqueRefs.filter(ref =>
        ref.number.toLowerCase().includes(referenceNumber.toLowerCase())
      );
      setFilteredNumbers(filtered);
    } else {
      setFilteredNumbers([]);
    }
  }, [referenceNumber, existingReferences]);

  useEffect(() => {
    if (referenceName && referenceNumber) {
      const isDuplicate = existingReferences.some(
        ref => ref.name.toLowerCase() === referenceName.toLowerCase() &&
               ref.number.toLowerCase() === referenceNumber.toLowerCase()
      );
      if (isDuplicate) {
        setDuplicateWarning('A quote with this reference name and number already exists.');
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [referenceName, referenceNumber, existingReferences]);

  const handleNameSelect = (option: ReferenceOption) => {
    setReferenceName(option.name);
    setReferenceNumber(option.number);
    setShowNameSuggestions(false);
  };

  const handleNumberSelect = (option: ReferenceOption) => {
    setReferenceName(option.name);
    setReferenceNumber(option.number);
    setShowNumberSuggestions(false);
  };

  const handleManualEntry = () => {
    setFileContent('Manual entry - no file uploaded');
  };

  const handleSubmit = async () => {
    if (fileContent.trim() && referenceName.trim() && referenceNumber.trim()) {
      setIsProcessing(true);
      try {
        await onProcessQuote({
          fileContent,
          referenceName,
          referenceNumber,
          file: uploadedFile || undefined,
          fileName: uploadedFile?.name,
        });
        setFileContent('');
        setUploadedFile(null);
        setReferenceName('');
        setReferenceNumber('');
      } catch (error) {
        console.error('Error processing quote:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Upload Quote</h2>

      {fileError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {fileError}
        </div>
      )}

      {duplicateWarning && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{duplicateWarning}</span>
        </div>
      )}

      {fileContent ? (
        <FilePreview
          file={uploadedFile}
          fileContent={fileContent}
          onRemove={handleRemoveFile}
        />
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-8 mb-6 transition-colors relative ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isReadingFile && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-lg z-10">
              <div className="flex flex-col items-center">
                <Loader className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-gray-700 font-medium">Reading file...</p>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-600 mb-2">Drag and drop a file here</p>
            <p className="text-gray-500 text-xs mb-3">PDF, Word, Excel, or Outlook Email</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.msg,.eml"
              onChange={handleFileInput}
              disabled={isReadingFile}
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium cursor-pointer hover:bg-gray-50 transition-colors"
            >
              Choose File
            </label>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
            <button
              onClick={handleManualEntry}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enter Manually
            </button>
            <p className="text-gray-500 text-xs mt-2">Skip file upload and add quote details in notes</p>
          </div>
        </div>
      )}

      {!fileContent && (
        <textarea
          className="w-full mb-6 p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={6}
          placeholder="Or paste your quote email or text here..."
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          onPaste={handlePaste}
          disabled={isReadingFile}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Name
          </label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter reference name"
            value={referenceName}
            onChange={(e) => setReferenceName(e.target.value)}
            onFocus={() => setShowNameSuggestions(true)}
            onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
          />
          {showNameSuggestions && filteredNames.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredNames.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleNameSelect(option)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-800">{option.name}</div>
                  <div className="text-xs text-gray-500">{option.number}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Number
          </label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter reference number"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            onFocus={() => setShowNumberSuggestions(true)}
            onBlur={() => setTimeout(() => setShowNumberSuggestions(false), 200)}
          />
          {showNumberSuggestions && filteredNumbers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredNumbers.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleNumberSelect(option)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-800">{option.number}</div>
                  <div className="text-xs text-gray-500">{option.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isProcessing || !fileContent.trim() || !referenceName.trim() || !referenceNumber.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      >
        {isProcessing && <Loader className="w-5 h-5 animate-spin" />}
        {isProcessing ? 'Processing...' : 'Process Quote'}
      </button>
    </div>
  );
}
