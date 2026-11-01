import { supabase } from '../lib/supabaseClient.js';

/**
 * Registrations API Handler (Vercel Serverless Function / Express Handler)
 */

export async function handleGetRegistrations(req, res) {
  const action = req.query.action || 'registrations'; // Default to 'registrations' if no action is specified

  try {
    if (action === 'registrations' || action === '') {
      const { data, error } = await supabase
        .from('registrations')
        .select('*');

      if (error) throw error;

      // Format response to match expected headers
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

export async function handleCreateRegistration(req, res) {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const grade = String(body.grade || '').trim();
    const events = String(body.events || '').trim();
    const fee = parseFloat(body.totalFee || body.fee || 0);

    if (!name || !grade || !events) {
      return res.status(400).json({ success: false, error: 'Missing required registration fields (name, grade, or events)' });
    }

    // Generate a random FKS ID (e.g., FKS-4829)
    const randomIdNum = Math.floor(1000 + Math.random() * 9000);
    const competitorId = `FKS-${randomIdNum}`;

    // Insert into Supabase
    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          id: competitorId,
          name: name,
          grade: grade,
          events: events,
          fee: fee,
          payment_status: 'Pending',
          timestamp: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      id: competitorId, 
      message: 'Registration successful' 
    });
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

    const formattedData = allRegistrations.map(row => ({
      ID: row.id,
      Name: row.name,
      Grade: row.grade,
      Events: row.events,
      Fee: row.fee,
      PaymentStatus: row.payment_status,
      Timestamp: row.timestamp
    }));

    return res.status(200).json({ success: true, registrations: formattedData });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') return handleGetRegistrations(req, res);
  
  if (req.method === 'POST' || req.method === 'PATCH') {
    const action = req.body?.action;
    if (action === 'updateRegistration') return handleUpdateRegistration(req, res);
    
    // If sent from PATCH or standard POST without action parameter, treat as a new registration or update check
    if (req.method === 'PATCH' || req.body?.PaymentStatus) return handleUpdateRegistration(req, res);
    
    // Otherwise, treat POST as a new competitor registration
    return handleCreateRegistration(req, res);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
