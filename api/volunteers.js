import { supabase } from '../lib/supabaseClient.js';

/**
 * Volunteer Directory API Handler
 * Converts script4.js functionality to Node.js & Supabase
 */

function splitList(v) {
  if (!v) return [];
  return String(v)
    .split(/[,;|\n\/]+/)
    .map(s => s.trim())
    .filter(s => {
      if (!s) return false;
      const low = s.toLowerCase();
      return low !== '-' && low !== '—' && low !== 'none' && low !== 'n/a' && low !== 'na';
    });
}

function buildVolunteer(row) {
  const name = String(row.full_name || '').trim();
  const mobile = String(row.mobile_number || '').trim();
  const grade = String(row.grade_level || '').trim();
  const roles = splitList(row.role);
  const events = splitList(row.scramble_events);

  return {
    fullName: name,
    mobileNumber: mobile,
    grade: grade,
    roles: roles.join(', '),
    scrambleEvents: events.join(', '),
    rolesList: roles,
    scrambleEventsList: events,
    Name: name,
    name: name,
    Mobile: mobile,
    Phone: mobile,
    mobile: mobile,
    Grade: grade,
    gradeLevel: grade,
    GradeLevel: grade,
    Role: roles.join(', '),
    role: roles.join(', '),
    ScrambleEvents: events.join(', '),
    Events: events.join(', '),
    events: events.join(', ')
  };
}

export async function handleGetVolunteers(req, res) {
  const action = req.query.action || '';

  try {
    if (action === 'diag') {
      const { data, count, error } = await supabase
        .from('volunteers')
        .select('*', { count: 'exact' });

      if (error) throw error;

      return res.status(200).json({
        status: 'success',
        tableName: 'volunteers',
        hasHeaderRow: true,
        dataRows: count || data.length,
        sampleParsedRow: data.length > 0 ? buildVolunteer(data[0]) : null,
        serverTime: new Date().toISOString()
      });
    }

    const { data, error } = await supabase
      .from('volunteers')
      .select('*');

    if (error) throw error;

    const list = data.map(buildVolunteer);
    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

export async function handlePostVolunteers(req, res) {
  try {
    const data = req.body || {};
    const action = data.action || '';

    if (action === 'registerVolunteer' || action === 'register') {
      const name = String(data.fullName || data.name || data.Name || '').trim();
      const mobileRaw = String(data.mobileNumber || data.mobile || data.Mobile || data.phone || '').trim();
      const grade = String(data.grade || data.gradeLevel || data.Grade || '').trim();
      
      const roles = Array.isArray(data.roles) ? data.roles.join(', ')
        : String(data.roles || data.role || data.Role || '').trim();
      
      const events = Array.isArray(data.scrambleEvents) ? data.scrambleEvents.join(', ')
        : String(data.scrambleEvents || data.events || data.Events || '').trim();

      if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
      if (!mobileRaw) return res.status(400).json({ success: false, error: 'Mobile number is required' });

      const mobileDigits = mobileRaw.replace(/\D/g, '');
      const mobileNum = parseInt(mobileDigits, 10);

      // Deduplicate on mobile number
      const { data: existing } = await supabase
        .from('volunteers')
        .select('id')
        .eq('mobile_number', mobileNum)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          success: false,
          duplicate: true,
          error: 'A volunteer is already registered with this mobile number.'
        });
      }

      const { error: insertErr } = await supabase
        .from('volunteers')
        .insert([{
          timestamp: new Date().toISOString(),
          full_name: name,
          mobile_number: mobileNum,
          grade_level: grade,
          role: roles,
          scramble_events: events
        }]);

      if (insertErr) throw insertErr;

      return res.status(200).json({
        success: true,
        fullName: name,
        mobileNumber: mobileRaw,
        roles: roles,
        scrambleEvents: events
      });
    }

    return res.status(400).json({ success: false, error: 'Unknown POST action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGetVolunteers(req, res);
  if (req.method === 'POST') return handlePostVolunteers(req, res);
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
