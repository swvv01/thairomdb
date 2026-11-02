/**
 * Script for one-time backfill of Cache-Control header for existing covers in Cloudflare R2
 * Usage: node web/scripts/backfill-covers-cache.mjs
 */

const WORKER_URL = process.env.WORKER_URL || 'https://r2-upload-worker.thairomdb.workers.dev';
const PURGE_KEY = process.env.PURGE_KEY || 'thairomdb-cache-key-2026';

async function runBackfill() {
  console.log('🚀 Starting Cover Cache-Control Backfill...');
  console.log(`📡 Worker: ${WORKER_URL}`);
  console.log('--------------------------------------------------');

  let batch = 1;
  let cursor = null;
  let hasMore = true;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    while (hasMore) {
      const url = new URL(`${WORKER_URL}/api/admin/backfill-covers-cache`);
      url.searchParams.set('limit', '100');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      process.stdout.write(`⏳ Batch ${batch}: Fetching and processing up to 100 objects... `);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'X-Purge-Key': PURGE_KEY,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Worker returned HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(`Operation failed: ${JSON.stringify(data)}`);
      }

      totalProcessed += data.processed;
      totalUpdated += data.updated;
      totalSkipped += data.skipped;

      console.log(`✅ Done!`);
      console.log(`   - Processed in batch: ${data.processed} (Updated: ${data.updated}, Skipped: ${data.skipped})`);
      console.log(`   - Cumulative totals : Processed: ${totalProcessed}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}`);

      hasMore = Boolean(data.hasMore && data.nextCursor);
      cursor = data.nextCursor;
      batch++;

      if (hasMore) {
        // Short pause between batches to be gentle on connection
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    console.log('--------------------------------------------------');
    console.log('🎉 Backfill completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   Total objects scanned: ${totalProcessed}`);
    console.log(`   Total updated        : ${totalUpdated}`);
    console.log(`   Already cached       : ${totalSkipped}`);
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

runBackfill();
