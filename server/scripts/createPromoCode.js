/**
 * Create a promo code in the database.
 *
 * Usage:
 *   node server/scripts/createPromoCode.js <CODE> <tier> <days|lifetime> [max_uses]
 *
 * Examples:
 *   node server/scripts/createPromoCode.js WIFE30    pro      30         5
 *   node server/scripts/createPromoCode.js EARLYBIRD lifetime lifetime   20
 *   node server/scripts/createPromoCode.js TESTER    pro      7
 *
 * tier      : pro | lifetime
 * days      : number of days to add, or the word "lifetime"
 * max_uses  : optional, defaults to unlimited
 *
 * Requires DATABASE_URL in your environment (same as the server).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../db/pool');

async function main() {
  const [,, code, tier, daysArg, maxUsesArg] = process.argv;

  if (!code || !tier || !daysArg) {
    console.error('Usage: node createPromoCode.js <CODE> <tier> <days|lifetime> [max_uses]');
    console.error('  tier    : pro | lifetime');
    console.error('  days    : number (e.g. 30) or "lifetime"');
    console.error('  max_uses: optional integer, omit for unlimited');
    process.exit(1);
  }

  if (!['pro', 'lifetime'].includes(tier)) {
    console.error('tier must be "pro" or "lifetime"');
    process.exit(1);
  }

  const isLifetime  = daysArg.toLowerCase() === 'lifetime';
  const durationDays = isLifetime ? null : parseInt(daysArg, 10);
  if (!isLifetime && (isNaN(durationDays) || durationDays < 1)) {
    console.error('days must be a positive integer or "lifetime"');
    process.exit(1);
  }

  const maxUses = maxUsesArg ? parseInt(maxUsesArg, 10) : null;
  const upperCode = code.toUpperCase().trim();

  const description = isLifetime
    ? `${tier} — lifetime access`
    : `${tier} — ${durationDays}-day access`;

  const { rows } = await pool.query(
    `INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE
       SET description   = EXCLUDED.description,
           grants_tier   = EXCLUDED.grants_tier,
           duration_days = EXCLUDED.duration_days,
           max_uses      = EXCLUDED.max_uses
     RETURNING *`,
    [upperCode, description, tier, durationDays, maxUses]
  );

  const row = rows[0];
  console.log('\n✓ Promo code saved:\n');
  console.log(`  Code       : ${row.code}`);
  console.log(`  Tier       : ${row.grants_tier}`);
  console.log(`  Duration   : ${row.duration_days ? row.duration_days + ' days' : 'lifetime'}`);
  console.log(`  Max uses   : ${row.max_uses ?? 'unlimited'}`);
  console.log(`  Used so far: ${row.used_count}`);
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
