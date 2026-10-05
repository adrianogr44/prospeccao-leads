// Roda uma vez ao subir o servidor: retoma pesquisas e importações interrompidas e liga o agendador.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ startRunner }, { startScheduler }, { startCnpjRunner }] = await Promise.all([
    import("./server/jobs/runner"),
    import("./server/jobs/scheduler"),
    import("./server/cnpj/runner"),
  ]);
  await startRunner();
  await startCnpjRunner();
  startScheduler();
}
