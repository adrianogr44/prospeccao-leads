// Roda uma vez ao subir o servidor: retoma pesquisas interrompidas e liga o agendador.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ startRunner }, { startScheduler }] = await Promise.all([
    import("./server/jobs/runner"),
    import("./server/jobs/scheduler"),
  ]);
  await startRunner();
  startScheduler();
}
