import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { ScanResultsEnhanced } from '../components/ScanResultsEnhanced';

const MessageScanner: React.FC = () => {
  const [content, setContent] = useState('');
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scan, setScan] = useState<any>(null);
  const [error, setError] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsScanning(true);

    try {
      const response = await api.post('/v2/scan/message', { content, sender, subject });
      setScanId(response.data.scanId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate scan');
      setIsScanning(false);
    }
  };

  const handleNewScan = () => {
    setScanId(null);
    setScan(null);
    setContent('');
    setSender('');
    setSubject('');
    setIsScanning(false);
  };

  React.useEffect(() => {
    if (!scanId) return;

    const fetchScan = async () => {
      try {
        const response = await api.get(`/v2/scans/${scanId}`);
        setScan(response.data);

        if (response.data.status !== 'completed' && response.data.status !== 'failed') {
          setTimeout(fetchScan, 2000);
        } else {
          setIsScanning(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch scan results');
        setIsScanning(false);
      }
    };

    fetchScan();
  }, [scanId]);

  if (scanId && scan?.status === 'completed') {
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
        <ScanResultsEnhanced result={scan} scanType="message" />
      </div>
    );
  }

  if (scanId && isScanning) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Message</h2>
          <p className="text-gray-600">Detecting manipulation tactics and emotional triggers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Message Threat Scanner</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Analyze messages, emails, and text for phishing, social engineering, and malicious content.
          Our AI-powered scanner detects manipulation tactics and credential harvesting attempts.
        </p>

        <form onSubmit={handleScan} className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject (Optional)
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isScanning}
            />
          </div>

          <div>
            <label htmlFor="sender" className="block text-sm font-medium text-gray-700 mb-2">
              Sender (Optional)
            </label>
            <input
              type="text"
              id="sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="sender@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isScanning}
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Message Content *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={12}
              placeholder="Paste the message content here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isScanning}
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={isScanning || !content}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Message...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Scan Message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageScanner;
