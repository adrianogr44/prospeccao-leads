-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "state" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "lat" REAL,
    "lng" REAL,
    "mapsUrl" TEXT,
    "businessStatus" TEXT,
    "website" TEXT,
    "siteStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sitePlatform" TEXT,
    "siteSignals" TEXT,
    "rating" REAL,
    "reviewCount" INTEGER,
    "openingHours" TEXT,
    "whatsapp" TEXT,
    "phone" TEXT,
    "phoneIsMobile" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "tiktok" TEXT,
    "ownerName" TEXT,
    "notes" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "stars" INTEGER NOT NULL DEFAULT 1,
    "scoreReasons" TEXT NOT NULL DEFAULT '[]',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "keywords" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "radiusKm" REAL NOT NULL DEFAULT 10,
    "provider" TEXT NOT NULL DEFAULT 'auto',
    "maxLeads" INTEGER NOT NULL DEFAULT 500,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "cursor" TEXT,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "enrichedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Search_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchLead" (
    "searchId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("searchId", "leadId"),
    CONSTRAINT "SearchLead_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SearchLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "keywords" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "radiusKm" REAL NOT NULL DEFAULT 10,
    "provider" TEXT NOT NULL DEFAULT 'auto',
    "maxLeads" INTEGER NOT NULL DEFAULT 500,
    "frequency" TEXT NOT NULL,
    "hour" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Blocked" (
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("source", "externalId")
);

-- CreateIndex
CREATE INDEX "Lead_dedupeKey_idx" ON "Lead"("dedupeKey");

-- CreateIndex
CREATE INDEX "Lead_city_state_idx" ON "Lead"("city", "state");

-- CreateIndex
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

-- CreateIndex
CREATE INDEX "Lead_stars_score_idx" ON "Lead"("stars", "score");

-- CreateIndex
CREATE INDEX "Lead_siteStatus_idx" ON "Lead"("siteStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_source_externalId_key" ON "Lead"("source", "externalId");

-- CreateIndex
CREATE INDEX "Search_status_idx" ON "Search"("status");

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLead_leadId_idx" ON "SearchLead"("leadId");

-- CreateIndex
CREATE INDEX "Schedule_active_nextRunAt_idx" ON "Schedule"("active", "nextRunAt");
