/**
 * FILE SCANNER - ESS DESIGN
 * OCR-powered multi-file threat analysis
 * Mobile-first with Elara Signature System
 */

import React, { useState } from 'react';
import { FileText, Loader2, ArrowLeft, Scan } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui';
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

  // Results View
  if (scanIds.length > 0 && scans.length > 0 && scans.every(s => s.status === 'completed')) {
    return (
      <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Button onClick={handleNewScan} variant="secondary" className="mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            New Scan
          </Button>
          {scans.map((scan, idx) => (
            <div key={scan.id || idx} className="space-y-4">
              <Card notched className="bg-primary-50 border-2 border-primary-200">
                <CardContent className="p-4">
                  <h2 className="text-xl font-bold text-text-primary">
                    File {idx + 1}: {scan.fileName}
                  </h2>
                </CardContent>
              </Card>
              <ScanResultsEnhanced result={scan} scanType="file" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Scanning View
  if (scanIds.length > 0 && isScanning) {
    return (
      <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card notched elevated className="spectral-thread">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary-600 animate-spin mb-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3 text-center">
                  Scanning Files
                </h2>
                <p className="text-lg text-text-secondary text-center">
                  Extracting text with OCR and analyzing for threats...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Upload Form View
  return (
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card notched className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  File Threat Scanner
                </h1>
                <p className="text-lg sm:text-xl text-white/90">
                  OCR-powered multi-file analysis with AI detection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card notched className="bg-primary-50 border-2 border-primary-200">
          <CardContent className="p-4 sm:p-6">
            <p className="text-base sm:text-lg text-text-secondary">
              Upload multiple images or PDFs for threat analysis. Our OCR scanner extracts text
              and analyzes for phishing, malware, and suspicious content.
            </p>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card notched elevated>
          <CardContent className="p-6 sm:p-8">
            <MultiFileUpload
              onFilesSelected={setSelectedFiles}
              maxFiles={10}
              maxFileSize={50 * 1024 * 1024}
              acceptedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']}
            />

            {error && (
              <Card className="mt-4 bg-red-50 border-2 border-red-300">
                <CardContent className="p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleScan}
              disabled={isScanning || selectedFiles.length === 0}
              className="mt-6 w-full text-lg py-6"
              size="lg"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Scanning {selectedFiles.length} file(s)...
                </>
              ) : (
                <>
                  <Scan className="w-5 h-5 mr-2" />
                  Scan {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card notched className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Scanner Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[
                'Multi-file upload (up to 10 files)',
                'OCR text extraction from images',
                'PDF text and metadata analysis',
                'AI-powered threat detection',
                'Emotion and manipulation pattern recognition',
                'QR code and embedded link scanning'
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-surface-base">
                  <FileText className="w-5 h-5 text-primary-500 flex-shrink-0 mt-1" />
                  <span className="text-base text-text-primary">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FileScanner;
