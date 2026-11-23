export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (process.env.NEXT_PHASE === 'phase-production-build') return;
        const { initializeDatabase } = await import('./lib/db');
        const { startCronJobs } = await import('./lib/backup');
        initializeDatabase();
        startCronJobs();
    }
}
