/**
 * MESSAGE SCANNER - ESS DESIGN
 * AI-powered phishing and social engineering detection
 * Mobile-first with Elara Signature System
 */

import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui';
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

  // Results View
  if (scanId && scan?.status === 'completed') {
    return (
      <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Button
            onClick={handleNewScan}
            variant="secondary"
            className="mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            New Scan
          </Button>
          <ScanResultsEnhanced result={scan} scanType="message" />
        </div>
      </div>
    );
  }

  // Scanning View
  if (scanId && isScanning) {
    return (
      <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card notched elevated className="spectral-thread">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary-600 animate-spin mb-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3 text-center">
                  Analyzing Message
                </h2>
                <p className="text-lg text-text-secondary text-center">
                  Detecting manipulation tactics and emotional triggers...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Scan Form View
  return (
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card notched className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Mail className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  Message Threat Scanner
                </h1>
                <p className="text-lg sm:text-xl text-white/90">
                  AI-powered phishing and social engineering detection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card notched className="bg-primary-50 border-2 border-primary-200">
          <CardContent className="p-4 sm:p-6">
            <p className="text-base sm:text-lg text-text-secondary">
              Analyze messages, emails, and text for phishing, social engineering, and malicious content.
              Our AI detects manipulation tactics and credential harvesting attempts.
            </p>
          </CardContent>
        </Card>

        {/* Scan Form */}
        <Card notched elevated>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleScan} className="space-y-6">
              {/* Subject Field */}
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full px-4 py-3 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary"
                  disabled={isScanning}
                />
              </div>

              {/* Sender Field */}
              <div>
                <label htmlFor="sender" className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                  Sender (Optional)
                </label>
                <input
                  type="text"
                  id="sender"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="sender@example.com"
                  className="w-full px-4 py-3 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary"
                  disabled={isScanning}
                />
              </div>

              {/* Content Field */}
              <div>
                <label htmlFor="content" className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                  Message Content *
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={12}
                  placeholder="Paste the message content here..."
                  className="w-full px-4 py-3 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary resize-none"
                  disabled={isScanning}
                />
              </div>

              {/* Error Message */}
              {error && (
                <Card className="bg-red-50 border-2 border-red-300">
                  <CardContent className="p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isScanning || !content}
                className="w-full text-lg py-6"
                size="lg"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Analyzing Message...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Scan Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Examples Card */}
        <Card notched className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Common Phishing Indicators</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[
                'Urgent language demanding immediate action',
                'Requests for personal or financial information',
                'Suspicious sender addresses or domains',
                'Poor grammar and spelling errors',
                'Threats or promises that seem too good to be true'
              ].map((indicator, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-surface-base">
                  <Mail className="w-5 h-5 text-primary-500 flex-shrink-0 mt-1" />
                  <span className="text-base text-text-primary">{indicator}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessageScanner;
