import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const counts = { donations: 3, individuals: 2, expenses: 4 };
const calls = [];
let signedIn = true;
const client = {
    auth: {
        getSession: async () => ({ data: { session: signedIn ? { user: { id: 'admin' } } : null } })
    },
    from(table) {
        return {
            select(_columns, options) {
                assert.equal(options?.count, 'exact');
                assert.equal(options?.head, true);
                return {
                    eq(column, year) {
                        calls.push(['count', table, column, year]);
                        return Promise.resolve({ count: counts[table], error: null });
                    }
                };
            },
            delete() {
                return {
                    eq(column, year) {
                        calls.push(['delete', table, column, year]);
                        counts[table] = 0;
                        return Promise.resolve({ error: null });
                    }
                };
            }
        };
    }
};
globalThis.window = { supabase: { createClient: () => client } };
const source = await readFile(new URL('./js/supabase.js', import.meta.url), 'utf8');
const { countYearEntries, clearYearEntries } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('clears only year-scoped entry tables and verifies zero remaining', async () => {
    assert.deepEqual(await countYearEntries(2026), { donations: 3, individuals: 2, expenses: 4 });
    await clearYearEntries(2026);
    assert.deepEqual(calls.filter(call => call[0] === 'delete'), [
        ['delete', 'expenses', 'year', 2026],
        ['delete', 'individuals', 'year', 2026],
        ['delete', 'donations', 'year', 2026]
    ]);
    assert.deepEqual(await countYearEntries(2026), { donations: 0, individuals: 0, expenses: 0 });
});

test('rejects unauthenticated deletion', async () => {
    signedIn = false;
    calls.length = 0;
    await assert.rejects(clearYearEntries(2026), /admin session has expired/);
    assert.equal(calls.length, 0);
});
