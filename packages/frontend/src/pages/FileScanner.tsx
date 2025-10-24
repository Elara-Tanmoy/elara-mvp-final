import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { MultiFileUpload } from '../components/MultiFileUpload';
import { ScanResultsEnhanced } from '../components/ScanResultsEnhanced';

const FileScanner: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanIds, setScanIds] = useState<string[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (selectedFiles.length === 0) return;

    setError('');
    setIsScanning(true);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/v2/scan/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setScanIds(response.data.scanIds || [response.data.scanId]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate scan');
      setIsScanning(false);
    }
  };

  const handleNewScan = () => {
    setScanIds([]);
    setScans([]);
    setSelectedFiles([]);
    setIsScanning(false);
  };

  React.useEffect(() => {
    if (scanIds.length === 0) return;

    const fetchScans = async () => {
      try {
        const scanPromises = scanIds.map(id => api.get(`/v2/scans/${id}`));
        const responses = await Promise.all(scanPromises);
        const scanData = responses.map(r => r.data);
        setScans(scanData);

        const allCompleted = scanData.every(s => s.status === 'completed' || s.status === 'failed');
        if (!allCompleted) {
          setTimeout(fetchScans, 2000);
        } else {
          setIsScanning(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch scan results');
        setIsScanning(false);
      }
    };

    fetchScans();
  }, [scanIds]);

  if (scanIds.length > 0 && scans.length > 0 && scans.every(s => s.status === 'completed')) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={handleNewScan}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Scan
        </button>
        {scans.map((scan, idx) => (
          <div key={scan.id || idx}>
            <h2 className="text-xl font-bold text-gray-900 mb-3">File {idx + 1}: {scan.fileName}</h2>
            <ScanResultsEnhanced result={scan} scanType="file" />
          </div>
        ))}
      </div>
    );
  }

  if (scanIds.length > 0 && isScanning) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Scanning Files</h2>
          <p className="text-gray-600">Extracting text and analyzing for threats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">File Threat Scanner</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Upload multiple images or PDFs for threat analysis. Our OCR-powered scanner extracts text
          and analyzes for phishing, malware, and suspicious content with emotion/manipulation detection.
        </p>

        <MultiFileUpload
          onFilesSelected={setSelectedFiles}
          maxFiles={10}
          maxFileSize={50 * 1024 * 1024}
          acceptedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']}
        />

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleScan}
          disabled={isScanning || selectedFiles.length === 0}
          className="mt-6 w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Scanning {selectedFiles.length} file(s)...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Scan {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
            </>
          )}
        </button>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Enhanced File Scanner Features</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Multi-file upload (up to 10 files)</li>
            <li>• OCR text extraction from images</li>
            <li>• PDF text analysis</li>
            <li>• Emotion & manipulation detection</li>
            <li>• Psychological trigger identification</li>
            <li>• URL detection in images</li>
            <li>• Phishing screenshot detection</li>
            <li>• Metadata analysis (EXIF data)</li>
            <li>• QR code phishing detection</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileScanner;
