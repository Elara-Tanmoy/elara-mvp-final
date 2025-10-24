import React, { useState } from 'react';
import { Heart, AlertCircle, Phone, ExternalLink, Loader2 } from 'lucide-react';
import api from '../lib/api';

interface RecoveryPlanStep {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  instructions: string;
  phone?: string;
  resources?: any[];
}

interface Resource {
  id: string;
  name: string;
  type: 'reporting' | 'financial' | 'emotional' | 'legal';
  description: string;
  phone?: string;
  url?: string;
  available24_7: boolean;
}

interface RecoveryResult {
  incidentId: string;
  emotionalAssessment: {
    distressLevel: 'low' | 'moderate' | 'high' | 'severe';
    suicidalIdeation: boolean;
  };
  recoveryPlan: {
    steps: RecoveryPlanStep[];
  };
  resources: Resource[];
}

const RecoverySupport: React.FC = () => {
  const [view, setView] = useState<'form' | 'plan' | 'resources'>('form');
  const [scamType, setScamType] = useState('');
  const [description, setDescription] = useState('');
  const [financialLoss, setFinancialLoss] = useState('');
  const [emotionalState, setEmotionalState] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState('');

  const scamTypes = [
    { id: 'phishing', name: 'Phishing / Email Scam', icon: '🎣' },
    { id: 'investment', name: 'Investment Fraud', icon: '💰' },
    { id: 'romance', name: 'Romance Scam', icon: '💔' },
    { id: 'tech_support', name: 'Tech Support Scam', icon: '💻' },
    { id: 'lottery', name: 'Lottery / Prize Scam', icon: '🎰' },
    { id: 'employment', name: 'Employment Scam', icon: '💼' },
    { id: 'other', name: 'Other', icon: '📋' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!scamType || !description.trim() || description.trim().length < 20) {
      setError('Please select a scam type and provide detailed description (at least 20 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/v2/recovery/incident', {
        scamType,
        description: description.trim(),
        financialLoss: financialLoss ? parseFloat(financialLoss) : undefined,
        emotionalState: emotionalState.trim() || undefined
      });

      setResult(response.data.data);
      setView('plan');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit incident report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadResources = async () => {
    try {
      const response = await api.get('/v2/recovery/resources');
      setResources(response.data.data.resources);
      setView('resources');
    } catch (err: any) {
      setError('Failed to load resources');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getDistressColor = (level: string) => {
    switch (level) {
      case 'severe':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  if (view === 'plan' && result) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => {
            setView('form');
            setResult(null);
            setDescription('');
            setScamType('');
            setFinancialLoss('');
            setEmotionalState('');
          }}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Report Another Incident
        </button>

        {/* Crisis Alert */}
        {result.emotionalAssessment.suicidalIdeation && (
          <div className="bg-red-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-start gap-4">
              <Phone className="w-8 h-8 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold mb-2">🚨 IMMEDIATE HELP AVAILABLE 🚨</h2>
                <p className="text-lg mb-4">
                  If you are in crisis or thinking about suicide, please reach out right now:
                </p>
                <div className="space-y-2 text-lg font-semibold">
                  <p>📞 Call or Text 988 (Suicide & Crisis Lifeline)</p>
                  <p>💬 Text HOME to 741741 (Crisis Text Line)</p>
                  <p>🚨 Call 911 if in immediate danger</p>
                </div>
                <p className="mt-4 text-sm">
                  Available 24/7. Free and confidential. You are not alone.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Emotional Assessment */}
        <div className={`shadow-lg rounded-lg p-6 ${getDistressColor(result.emotionalAssessment.distressLevel)}`}>
          <h3 className="text-lg font-bold mb-2">Emotional Assessment</h3>
          <p>
            Based on your report, we've assessed your distress level as{' '}
            <strong>{result.emotionalAssessment.distressLevel.toUpperCase()}</strong>.
          </p>
          <p className="mt-2 text-sm">
            Remember: What you're feeling is valid. Many scam victims experience similar emotions. Recovery is possible.
          </p>
        </div>

        {/* Incident ID */}
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-600">
            <strong>Incident ID:</strong> {result.incidentId}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Save this ID for your records and follow-ups
          </p>
        </div>

        {/* Recovery Plan */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Heart className="w-7 h-7 text-red-500" />
            Your Personalized Recovery Plan
          </h2>

          <div className="space-y-6">
            {result.recoveryPlan.steps.map((step, index) => (
              <div
                key={step.id}
                className={`border-2 rounded-lg p-6 ${getPriorityColor(step.priority)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white font-bold text-gray-900">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold">{step.title}</h3>
                      <span className="text-xs font-semibold uppercase px-2 py-1 rounded">
                        {step.priority}
                      </span>
                    </div>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: step.instructions.replace(/\n/g, '<br />') }}
                    />
                    {step.phone && (
                      <a
                        href={`tel:${step.phone}`}
                        className="inline-flex items-center gap-2 mt-3 font-semibold hover:underline"
                      >
                        <Phone className="w-4 h-4" />
                        {step.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.resources.slice(0, 6).map((resource) => (
              <div key={resource.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-primary-500 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{resource.name}</h3>
                  {resource.available24_7 && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                      24/7
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-3">{resource.description}</p>
                <div className="flex flex-wrap gap-2">
                  {resource.phone && (
                    <a
                      href={`tel:${resource.phone}`}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {resource.phone}
                    </a>
                  )}
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visit Website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={loadResources}
            className="mt-4 text-primary-600 hover:text-primary-700 font-semibold"
          >
            View All Resources →
          </button>
        </div>

        {/* Encouragement */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-2">💪 You Can Recover</h3>
          <p className="text-gray-700 mb-2">
            Many people have successfully recovered from scams. Taking these steps puts you on the path to recovery.
          </p>
          <p className="text-gray-700">
            Remember: This was not your fault. Scammers are professionals who manipulate emotions and exploit trust.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'resources') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => setView(result ? 'plan' : 'form')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Recovery Resources</h2>
          <p className="text-gray-600 mb-6">Comprehensive list of organizations that can help</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resources.map((resource) => (
              <div key={resource.id} className="border-2 border-gray-200 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">{resource.name}</h3>
                  {resource.available24_7 && (
                    <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                      24/7
                    </span>
                  )}
                </div>
                <span className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded mb-3">
                  {resource.type.replace('_', ' ')}
                </span>
                <p className="text-gray-700 mb-4">{resource.description}</p>
                <div className="space-y-2">
                  {resource.phone && (
                    <a
                      href={`tel:${resource.phone}`}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      <Phone className="w-4 h-4" />
                      {resource.phone}
                    </a>
                  )}
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Incident Report Form
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-gray-900">Recovery Support</h1>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-r">
          <p className="text-blue-900 font-medium">
            💙 We're here to help you recover. Your information is confidential and will be used to provide personalized support.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What type of scam did you experience?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {scamTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setScamType(type.id)}
                  className={`p-3 border-2 rounded-lg text-center transition-colors ${
                    scamType === type.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-xs font-medium">{type.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please describe what happened
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us your story. Include details about how you were contacted, what they promised, and what happened next..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <p className="text-sm text-gray-500 mt-1">
              {description.length}/5,000 characters (minimum 20)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Financial Loss (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                value={financialLoss}
                onChange={(e) => setFinancialLoss(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How are you feeling? (optional)
            </label>
            <textarea
              value={emotionalState}
              onChange={(e) => setEmotionalState(e.target.value)}
              placeholder="It's okay to share your emotions - anxious, angry, embarrassed, hopeless, etc. This helps us provide better support."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !scamType || description.trim().length < 20}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Recovery Plan...
              </>
            ) : (
              <>
                <Heart className="w-5 h-5" />
                Get Personalized Support
              </>
            )}
          </button>
        </form>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={loadResources}
            className="py-3 px-6 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            View All Resources
          </button>

          <a
            href="#crisis"
            onClick={(e) => {
              e.preventDefault();
              window.open('tel:988');
            }}
            className="py-3 px-6 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Crisis Hotline: 988
          </a>
        </div>

        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-2">🌟 You Are Not Alone</h3>
          <p className="text-sm text-purple-800">
            Millions of people fall victim to scams each year. It's not a reflection of your intelligence.
            Scammers use sophisticated psychological tactics. The important thing is that you're taking steps to recover.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecoverySupport;
