import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ApiError } from "@/lib/contract";

/** Erro esperado, com status HTTP e mensagem segura para o cliente. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, error: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

function invalid(error: z.ZodError): HttpError {
  return new HttpError(
    400,
    "Dados inválidos.",
    error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

/** Valida a query string; parâmetros vazios (?q=) são tratados como ausentes. */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const entries = [...req.nextUrl.searchParams.entries()].filter(([, v]) => v !== "");
  const result = schema.safeParse(Object.fromEntries(entries));
  if (!result.success) throw invalid(result.error);
  return result.data;
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "O corpo da requisição não é um JSON válido.");
  }
  const result = schema.safeParse(json);
  if (!result.success) throw invalid(result.error);
  return result.data;
}

/** Envolve um handler: converte erros conhecidos em ApiError e esconde detalhes internos. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.message, err.details);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return errorResponse(404, "Registro não encontrado.");
    }
    console.error("[api] erro inesperado:", err);
    return errorResponse(500, "Erro interno. Tente novamente.");
  }
}

export type IdContext = { params: Promise<{ id: string }> };
