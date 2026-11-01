import { supabase } from '../lib/supabaseClient.js';

/**
 * Registrations API Handler (Vercel Serverless Function / Express Handler)
 * Consolidates functionality from script1.js & script2.js
 */

export async function handleGetRegistrations(req, res) {
  const action = req.query.action || '';

  try {
    if (action === 'registrations') {
      const { data, error } = await supabase
        .from('registrations')
        .select('*');

      if (error) throw error;

      // Format response to match legacy sheet headers if needed
      const formattedData = data.map(row => ({
        ID: row.id,
        Name: row.name,
        Grade: row.grade,
        Events: row.events,
        Fee: row.fee,
        PaymentStatus: row.payment_status,
        Timestamp: row.timestamp
      }));

      return res.status(200).json({ success: true, data: formattedData });
    }

    if (action === 'participants') {
      // Fetch paid participants for public roster
      const { data, error } = await supabase
        .from('registrations')
        .select('id, name, grade, events, payment_status')
        .ilike('payment_status', 'Paid');

      if (error) throw error;

      const participants = data.map(row => ({
        Name: row.name,
        Grade: row.grade,
        Events: row.events,
        CompetitorID: row.id
      }));

      return res.status(200).json({ success: true, participants });
    }

    return res.status(400).json({ success: false, error: `Unknown GET action: ${action}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleUpdateRegistration(req, res) {
  try {
    const body = req.body || {};
    const id = String(body.id || body.ID || body.Username || '').trim();
    const status = String(body.PaymentStatus || body['Payment Status'] || body.Status || '').trim();

    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing id' });
    }
    if (!/^(paid|pending)$/i.test(status)) {
      return res.status(400).json({ success: false, error: `Status must be Paid or Pending, got: ${status}` });
    }

    const formattedStatus = status.toLowerCase() === 'paid' ? 'Paid' : 'Pending';

    // Update in Supabase
    const { data, error } = await supabase
      .from('registrations')
      .update({ payment_status: formattedStatus })
      .ilike('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: `ID not found: ${id}` });
    }

    // Fetch refreshed registrations list
    const { data: allRegistrations, error: fetchErr } = await supabase
      .from('registrations')
      .select('*');

    if (fetchErr) throw fetchErr;

    return res.status(200).json({ success: true, registrations: allRegistrations });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGetRegistrations(req, res);
  if (req.method === 'POST') {
    if (req.body?.action === 'updateRegistration') return handleUpdateRegistration(req, res);
    return res.status(400).json({ success: false, error: 'Unknown POST action' });
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
