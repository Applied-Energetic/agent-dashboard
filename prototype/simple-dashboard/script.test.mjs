import assert from 'node:assert/strict';
import {
	FALLBACK_DATA,
	formatSyncTime,
	getHeatmapLevel,
} from './script.js';

assert.equal(FALLBACK_DATA.activity.length, 365);
assert.equal(getHeatmapLevel(0), 0);
assert.equal(getHeatmapLevel(5), 4);
assert.equal(
	formatSyncTime(new Date('2026-07-15T09:42:00')),
	'Last sync 09:42',
);

console.log('simple-dashboard helpers: pass');
