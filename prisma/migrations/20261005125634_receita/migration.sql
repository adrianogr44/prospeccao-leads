-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "contactSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN "contactSourceAt" DATETIME;

-- CreateTable
CREATE TABLE "Cnpj" (
    "cnpj" TEXT NOT NULL PRIMARY KEY,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "nomeNormalizado" TEXT NOT NULL,
    "razaoNormalizada" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "bairro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "cep" TEXT,
    "cnaePrincipal" TEXT,
    "situacao" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "dumpMonth" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CnpjMunicipio" (
    "codigo" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CnpjImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dumpMonth" TEXT NOT NULL,
    "cities" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "cursor" TEXT,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "examinedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "phoneCount" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "ambiguousCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Cnpj_municipio_nomeNormalizado_idx" ON "Cnpj"("municipio", "nomeNormalizado");

-- CreateIndex
CREATE INDEX "Cnpj_municipio_razaoNormalizada_idx" ON "Cnpj"("municipio", "razaoNormalizada");

-- CreateIndex
CREATE INDEX "CnpjMunicipio_nomeNormalizado_idx" ON "CnpjMunicipio"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "CnpjImport_status_idx" ON "CnpjImport"("status");

-- CreateIndex
CREATE INDEX "CnpjImport_createdAt_idx" ON "CnpjImport"("createdAt");
