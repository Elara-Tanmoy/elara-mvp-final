-- CreateEnum
CREATE TYPE "LiteracyLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "LessonDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "QuizCategory" AS ENUM ('phishing', 'passwords', 'social_engineering', 'malware', 'privacy');

-- CreateEnum
CREATE TYPE "ScamType" AS ENUM ('phishing', 'investment', 'romance', 'tech_support', 'lottery', 'employment', 'other');

-- CreateEnum
CREATE TYPE "DistressLevel" AS ENUM ('low', 'moderate', 'high', 'severe');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('reported', 'in_progress', 'resolved', 'needs_help');

-- CreateTable
CREATE TABLE "LiteracyQuizResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "literacyLevel" "LiteracyLevel" NOT NULL,
    "knowledgeGaps" TEXT[],
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyQuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteracyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryIncident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scamType" "ScamType" NOT NULL,
    "description" TEXT NOT NULL,
    "financialLoss" DOUBLE PRECISION,
    "personalInfoShared" TEXT[],
    "whenOccurred" TEXT,
    "alreadyReported" BOOLEAN NOT NULL DEFAULT false,
    "emotionalState" TEXT,
    "distressLevel" "DistressLevel" NOT NULL DEFAULT 'moderate',
    "suicidalIdeation" BOOLEAN NOT NULL DEFAULT false,
    "status" "IncidentStatus" NOT NULL DEFAULT 'reported',
    "recoveryPlanSteps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryFollowUp" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "notes" TEXT,
    "emotionalState" TEXT,
    "distressLevel" "DistressLevel",
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiteracyQuizResult_userId_idx" ON "LiteracyQuizResult"("userId");

-- CreateIndex
CREATE INDEX "LiteracyQuizResult_literacyLevel_idx" ON "LiteracyQuizResult"("literacyLevel");

-- CreateIndex
CREATE INDEX "LiteracyQuizResult_createdAt_idx" ON "LiteracyQuizResult"("createdAt");

-- CreateIndex
CREATE INDEX "LiteracyProgress_userId_idx" ON "LiteracyProgress"("userId");

-- CreateIndex
CREATE INDEX "LiteracyProgress_lessonId_idx" ON "LiteracyProgress"("lessonId");

-- CreateIndex
CREATE INDEX "LiteracyProgress_completed_idx" ON "LiteracyProgress"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyProgress_userId_lessonId_key" ON "LiteracyProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "RecoveryIncident_userId_idx" ON "RecoveryIncident"("userId");

-- CreateIndex
CREATE INDEX "RecoveryIncident_scamType_idx" ON "RecoveryIncident"("scamType");

-- CreateIndex
CREATE INDEX "RecoveryIncident_distressLevel_idx" ON "RecoveryIncident"("distressLevel");

-- CreateIndex
CREATE INDEX "RecoveryIncident_suicidalIdeation_idx" ON "RecoveryIncident"("suicidalIdeation");

-- CreateIndex
CREATE INDEX "RecoveryIncident_status_idx" ON "RecoveryIncident"("status");

-- CreateIndex
CREATE INDEX "RecoveryIncident_createdAt_idx" ON "RecoveryIncident"("createdAt");

-- CreateIndex
CREATE INDEX "RecoveryFollowUp_incidentId_idx" ON "RecoveryFollowUp"("incidentId");

-- CreateIndex
CREATE INDEX "RecoveryFollowUp_scheduledFor_idx" ON "RecoveryFollowUp"("scheduledFor");

-- CreateIndex
CREATE INDEX "RecoveryFollowUp_completedAt_idx" ON "RecoveryFollowUp"("completedAt");

-- AddForeignKey
ALTER TABLE "RecoveryFollowUp" ADD CONSTRAINT "RecoveryFollowUp_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "RecoveryIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
