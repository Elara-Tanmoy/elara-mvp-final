import React, { useState } from 'react';
import { GraduationCap, BookOpen, CheckCircle, Loader2, Award } from 'lucide-react';
import api from '../lib/api';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  category: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  literacyLevel: 'beginner' | 'intermediate' | 'advanced';
  knowledgeGaps: string[];
}

interface Lesson {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  duration: number;
  description: string;
  content?: string;
}

const LiteracyCoach: React.FC = () => {
  const [view, setView] = useState<'menu' | 'quiz' | 'lessons' | 'results'>('menu');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [_selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const startQuiz = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get('/v2/literacy/quiz');
      setQuiz(response.data.data.quiz);
      setUserAnswers([]);
      setCurrentQuestion(0);
      setView('quiz');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = (answerIndex: number) => {
    const newAnswers = [...userAnswers, answerIndex];
    setUserAnswers(newAnswers);

    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (answers: number[]) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/v2/literacy/quiz/submit', { answers });
      setResult(response.data.data.quizResult);
      setView('results');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLessons = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get('/v2/literacy/lessons');
      setLessons(response.data.data.lessons);
      setView('lessons');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'text-green-600 bg-green-100';
      case 'intermediate':
        return 'text-blue-600 bg-blue-100';
      case 'advanced':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'phishing':
        return '🎣';
      case 'passwords':
        return '🔐';
      case 'social_engineering':
        return '🎭';
      case 'malware':
        return '🦠';
      case 'privacy':
        return '🔒';
      default:
        return '📚';
    }
  };

  if (view === 'quiz' && quiz.length > 0) {
    const question = quiz[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.length) * 100;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Question {currentQuestion + 1} of {quiz.length}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {question.category.replace('_', ' ')} • {question.difficulty}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">{question.question}</h2>

          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => submitAnswer(index)}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-gray-900">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results' && result) {
    const scorePercentage = (result.score / 100) * 100;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Menu
        </button>

        {/* Score Card */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <Award className="w-16 h-16 text-yellow-500" />
          </div>

          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Quiz Complete!
          </h2>

          <p className="text-center text-gray-600 mb-8">
            You scored {result.correctAnswers} out of {result.totalQuestions}
          </p>

          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <svg className="w-48 h-48 transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="#e5e7eb"
                  strokeWidth="16"
                  fill="none"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="#3B82F6"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${scorePercentage * 5.53} 553`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-900">{result.score}</div>
                  <div className="text-sm text-gray-600 mt-1">out of 100</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mb-8">
            <span className={`px-6 py-3 rounded-full text-lg font-bold ${getLevelColor(result.literacyLevel)}`}>
              {result.literacyLevel.toUpperCase()} LEVEL
            </span>
          </div>

          {result.knowledgeGaps.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-yellow-900 mb-2">Areas for Improvement:</h3>
              <ul className="text-yellow-800 space-y-1">
                {result.knowledgeGaps.map((gap, index) => (
                  <li key={index}>• {gap.replace('_', ' ')}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={startQuiz}
            className="bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 flex items-center justify-center gap-2"
          >
            <GraduationCap className="w-5 h-5" />
            Retake Quiz
          </button>
          <button
            onClick={loadLessons}
            className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            View Lessons
          </button>
        </div>
      </div>
    );
  }

  if (view === 'lessons') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Menu
        </button>

        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Available Lessons</h2>
          <p className="text-gray-600 mb-6">
            Choose a lesson to improve your digital security knowledge
          </p>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="border-2 border-gray-200 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedLesson(lesson)}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">{getCategoryIcon(lesson.category)}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{lesson.title}</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getLevelColor(lesson.difficulty)}`}>
                          {lesson.difficulty}
                        </span>
                        <span className="text-sm text-gray-600">{lesson.duration} min</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">{lesson.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Digital Literacy Coach</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Improve your digital security knowledge through interactive quizzes and personalized lessons.
        </p>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={startQuiz}
            disabled={isLoading}
            className="bg-primary-600 text-white p-8 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors"
          >
            <GraduationCap className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Take Assessment Quiz</h3>
            <p className="text-sm text-primary-100">
              20 questions to evaluate your digital literacy level
            </p>
          </button>

          <button
            onClick={loadLessons}
            disabled={isLoading}
            className="bg-green-600 text-white p-8 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            <BookOpen className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Browse Lessons</h3>
            <p className="text-sm text-green-100">
              Learn about phishing, passwords, malware, and more
            </p>
          </button>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">What You'll Learn:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Phishing Detection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Password Security</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Social Engineering</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Malware Protection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Privacy & Data Protection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Safe Browsing Habits</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiteracyCoach;
