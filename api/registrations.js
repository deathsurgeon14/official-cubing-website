import { supabase } from '../lib/supabaseClient.js';

/**
 * Registrations API Handler (Vercel Serverless Function)
 * Serves frontend forms, admin dashboard, and public rosters.
 */

export async function handleGetRegistrations(req, res) {
  const action = req.query.action || 'registrations';

  try {
    if (action === 'registrations' || action === '') {
      const { data, error } = await supabase
        .from('registrations')
        .select('*');

      if (error) throw error;

      const formattedData = (data || []).map(row => ({
        ID: row.ID || row.id || row.Username || '—',
        Name: row.Name || row.name || '—',
        Grade: row.Grade || row.grade || '—',
        Events: row.Events || row.events || '—',
        Fee: row.Fee !== undefined ? row.Fee : (row.fee !== undefined ? row.fee : 0),
        PaymentStatus: row.PaymentStatus || row.payment_status || row.Status || 'Pending',
        Timestamp: row.Timestamp || row.timestamp || row.created_at || ''
      }));

      return res.status(200).json({ success: true, data: formattedData });
    }

    if (action === 'participants') {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .or('payment_status.ilike.Paid,PaymentStatus.ilike.Paid');

      if (error) throw error;

      const participants = (data || []).map(row => ({
        Name: row.Name || row.name || '—',
        Grade: row.Grade || row.grade || '—',
        Events: row.Events || row.events || '—',
        CompetitorID: row.ID || row.id || '—'
      }));

      return res.status(200).json({ success: true, participants });
    }

    return res.status(400).json({ success: false, error: `Unknown GET action: ${action}` });
  } catch (err) {
    console.error('API GET Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleCreateRegistration(req, res) {
  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const name = String(body.name || body.Name || '').trim();
    const grade = String(body.grade || body.Grade || '').trim();
    const events = String(body.events || body.Events || '').trim();
    const fee = parseFloat(body.totalFee || body.fee || body.Fee || 0);

    if (!name || !grade || !events) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required registration fields (name, grade, or events)' 
      });
    }

    // Check for duplicate registration by name and grade
    const { data: existing } = await supabase
      .from('registrations')
      .select('*')
      .or(`name.ilike.${name},Name.ilike.${name}`)
      .or(`grade.ilike.${grade},Grade.ilike.${grade}`);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `A registration for ${name} (${grade}) already exists.`
      });
    }

    // Generate unique competitor ID (e.g. FKS-4829)
    const randomIdNum = Math.floor(1000 + Math.random() * 9000);
    const competitorId = `FKS-${randomIdNum}`;
    const timestamp = new Date().toISOString();

    // Dual-map every column (both lowercase and capitalized keys) to satisfy Supabase schema cache
    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          id: competitorId,
          ID: competitorId,
          name: name,
          Name: name,
          grade: grade,
          Grade: grade,
          events: events,
          Events: events,
          fee: fee,
          Fee: fee,
          payment_status: 'Pending',
          PaymentStatus: 'Pending',
          timestamp: timestamp,
          Timestamp: timestamp
        }
      ])
      .select();

    if (error) throw error;

    return res.status(201).json({ 
      success: true, 
      id: competitorId, 
      message: 'Registration created successfully' 
    });
  } catch (err) {
    console.error('API CREATE Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleUpdateRegistration(req, res) {
  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const id = String(body.id || body.ID || body.Username || '').trim();
    const status = String(body.PaymentStatus || body['Payment Status'] || body.Status || body.payment_status || '').trim();

    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing competitor ID' });
    }

    if (!/^(paid|pending)$/i.test(status)) {
      return res.status(400).json({ success: false, error: `Status must be Paid or Pending, got: ${status}` });
    }

    const formattedStatus = status.toLowerCase() === 'paid' ? 'Paid' : 'Pending';

    // Dual-map payment status updates as well
    const { data, error } = await supabase
      .from('registrations')
      .update({ 
        payment_status: formattedStatus,
        PaymentStatus: formattedStatus
      })
      .or(`id.ilike.${id},ID.ilike.${id}`)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: `Competitor ID not found: ${id}` });
    }

    const { data: allRegistrations, error: fetchErr } = await supabase
      .from('registrations')
      .select('*');

    if (fetchErr) throw fetchErr;

    const formattedData = (allRegistrations || []).map(row => ({
      ID: row.ID || row.id || '—',
      Name: row.Name || row.name || '—',
      Grade: row.Grade || row.grade || '—',
      Events: row.Events || row.events || '—',
      Fee: row.Fee !== undefined ? row.Fee : (row.fee !== undefined ? row.fee : 0),
      PaymentStatus: row.PaymentStatus || row.payment_status || row.Status || 'Pending',
      Timestamp: row.Timestamp || row.timestamp || ''
    }));

    return res.status(200).json({ 
      success: true, 
      message: 'Payment status updated',
      registrations: formattedData 
    });
  } catch (err) {
    console.error('API UPDATE Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGetRegistrations(req, res);
  }

  if (req.method === 'PATCH') {
    return handleUpdateRegistration(req, res);
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const action = body?.action;
    
    if (action === 'updateRegistration' || body?.PaymentStatus) {
      return handleUpdateRegistration(req, res);
    }
    
    return handleCreateRegistration(req, res);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
