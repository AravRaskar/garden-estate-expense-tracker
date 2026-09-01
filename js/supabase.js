// ============================================
// Supabase Client & Data Operations
// ============================================

const SUPABASE_URL = 'https://iiiqmoagfthspvuleuxp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JsKQQekb1Zqy1XDbuScrfw_aC0ugayl';

let client = null;

export function getSupabase() {
    if (!client) {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
}

// ── Auth ─────────────────────────────────────

export async function signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data: { session } } = await getSupabase().auth.getSession();
    return session;
}

export function onAuthStateChange(callback) {
    return getSupabase().auth.onAuthStateChange(callback);
}

// ── Buildings & Flats ────────────────────────

export async function fetchBuildings() {
    const { data, error } = await getSupabase()
        .from('buildings')
        .select('*')
        .order('display_order', { ascending: true });
    if (error) throw error;
    return data;
}

export async function fetchFlats(buildingId) {
    const { data, error } = await getSupabase()
        .from('flats')
        .select('*')
        .eq('building_id', buildingId)
        .order('display_order', { ascending: true });
    if (error) throw error;
    return data;
}

// ── Donations ────────────────────────────────

export async function fetchDonations(buildingId, year) {
    const { data, error } = await getSupabase()
        .from('donations')
        .select(`
            *,
            flats ( id, flat_number, display_order )
        `)
        .eq('building_id', buildingId)
        .eq('year', year);
    if (error) throw error;
    return data;
}

export async function fetchAllDonations(year) {
    const { data, error } = await getSupabase()
        .from('donations')
        .select(`
            *,
            buildings ( id, name, display_order ),
            flats ( id, flat_number )
        `)
        .eq('year', year);
    if (error) throw error;
    return data;
}

export async function upsertDonation(flatId, buildingId, year, donationData) {
    const record = {
        flat_id: flatId,
        building_id: buildingId,
        year: year,
        owner_name: donationData.ownerName || '',
        donated: donationData.donated || false,
        amount: donationData.donated ? (parseFloat(donationData.amount) || 0) : 0,
        transaction_type: donationData.donated ? (donationData.transactionType || '') : '',
        date_given: donationData.donated ? (donationData.dateGiven || null) : null,
    };

    const { data, error } = await getSupabase()
        .from('donations')
        .upsert(record, { onConflict: 'flat_id,year' })
        .select();
    if (error) throw error;
    return data;
}

export async function deleteDonation(flatId, year) {
    const { data, error } = await getSupabase()
        .from('donations')
        .delete()
        .eq('flat_id', flatId)
        .eq('year', year);
    if (error) throw error;
    return data;
}

export async function bulkUpsertDonations(records) {
    if (!records || records.length === 0) return [];
    const BATCH_SIZE = 500;
    const results = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { data, error } = await getSupabase()
            .from('donations')
            .upsert(batch, { onConflict: 'flat_id,year' })
            .select();
        if (error) throw error;
        if (data) results.push(...data);
    }

    return results;
}

// ── Individuals CRUD ─────────────────────────

export async function fetchIndividuals(year) {
    const { data, error } = await getSupabase()
        .from('individuals')
        .select('*')
        .eq('year', year)
        .order('date_given', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function saveIndividual(record) {
    const { data, error } = await getSupabase()
        .from('individuals')
        .upsert(record)
        .select();
    if (error) throw error;
    return data;
}

export async function deleteIndividual(id) {
    const { data, error } = await getSupabase()
        .from('individuals')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return data;
}

// ── Expenses CRUD ────────────────────────────

export async function fetchExpenses(year) {
    const { data, error } = await getSupabase()
        .from('expenses')
        .select('*')
        .eq('year', year)
        .order('date_spent', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function saveExpense(record) {
    const { data, error } = await getSupabase()
        .from('expenses')
        .upsert(record)
        .select();
    if (error) throw error;
    return data;
}

export async function deleteExpense(id) {
    const { data, error } = await getSupabase()
        .from('expenses')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return data;
}

// ── Timetables CRUD ──────────────────────────

export async function fetchTimetables(year) {
    const { data, error } = await getSupabase()
        .from('timetables')
        .select('*')
        .eq('year', year)
        .order('event_date', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function saveTimetable(record) {
    const { data, error } = await getSupabase()
        .from('timetables')
        .upsert(record)
        .select();
    if (error) throw error;
    return data;
}

export async function deleteTimetable(id) {
    const { data, error } = await getSupabase()
        .from('timetables')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return data;
}

// ── Utilities / Search / Export ──────────────

export async function searchDonations(query, year) {
    const { data, error } = await getSupabase()
        .from('donations')
        .select(`
            *,
            buildings ( id, name ),
            flats ( id, flat_number )
        `)
        .eq('year', year)
        .ilike('owner_name', `%${query}%`)
        .order('owner_name')
        .limit(20);
    if (error) throw error;
    return data;
}

export async function getDistinctYears() {
    const { data: dData } = await getSupabase().from('donations').select('year');
    const { data: iData } = await getSupabase().from('individuals').select('year');
    const { data: eData } = await getSupabase().from('expenses').select('year');

    const years = new Set([
        ...(dData || []).map(d => d.year),
        ...(iData || []).map(d => d.year),
        ...(eData || []).map(d => d.year)
    ]);
    return [...years].sort((a, b) => b - a);
}

export async function fetchAllBuildingsAndFlats() {
    const { data: buildings, error: bError } = await getSupabase()
        .from('buildings')
        .select('id, name')
        .order('display_order');
    if (bError) throw bError;

    const { data: flats, error: fError } = await getSupabase()
        .from('flats')
        .select('id, building_id, flat_number');
    if (fError) throw fError;

    return { buildings, flats };
}

export async function exportAllData(year) {
    const { data, error } = await getSupabase()
        .from('donations')
        .select(`
            owner_name, donated, amount, transaction_type, date_given,
            buildings ( name ),
            flats ( flat_number )
        `)
        .eq('year', year)
        .order('buildings(display_order)')
        .order('flats(display_order)');
    if (error) throw error;
    return data;
}
