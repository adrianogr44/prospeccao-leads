import { outreachSettingsSchema, type OutreachSettings } from "@/lib/contract";
import { DEFAULT_OUTREACH_SETTINGS } from "@/lib/outreach";
import { db } from "./db";

const OUTREACH_KEY = "outreach";

/** Configuração salva, ou o padrão quando não há linha (ou o JSON salvo ficou inválido). Blocos ausentes em linhas antigas recebem o padrão. */
export async function getOutreachSettings(): Promise<OutreachSettings> {
  const row = await db.setting.findUnique({ where: { key: OUTREACH_KEY } });
  if (!row) return DEFAULT_OUTREACH_SETTINGS;
  try {
    const saved: unknown = JSON.parse(row.value);
    if (typeof saved !== "object" || saved === null) return DEFAULT_OUTREACH_SETTINGS;
    const parsed = outreachSettingsSchema.safeParse({ ...DEFAULT_OUTREACH_SETTINGS, ...saved });
    return parsed.success ? parsed.data : DEFAULT_OUTREACH_SETTINGS;
  } catch {
    return DEFAULT_OUTREACH_SETTINGS;
  }
}

export async function saveOutreachSettings(settings: OutreachSettings): Promise<OutreachSettings> {
  const value = JSON.stringify(settings);
  await db.setting.upsert({
    where: { key: OUTREACH_KEY },
    create: { key: OUTREACH_KEY, value },
    update: { value },
  });
  return settings;
}
