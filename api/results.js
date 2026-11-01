import { supabase } from '../lib/supabaseClient.js';

/**
 * Results API Handler
 * Converts script3.js functionality (Submit results, Recalculate ranks, Fetch station timings)
 */

function parseTime(val) {
  const num = parseFloat(val);
  return isNaN(num) || num <= 0 ? 999999 : num;
}

async function recalculateRanks(event, round) {
  // Fetch all rows for given event and round
  const { data, error } = await supabase
    .from('results')
    .select('id, best')
    .eq('event', event)
    .eq('round', round);

  if (error || !data) return;

  // Sort competitors strictly by Best single time ascending
  const sorted = [...data].sort((a, b) => parseTime(a.best) - parseTime(b.best));

  // Update ranks in database
  for (let index = 0; index < sorted.length; index++) {
    const item = sorted[index];
    const rankVal = parseTime(item.best) === 999999 ? 0 : index + 1;

    await supabase
      .from('results')
      .update({ rank: rankVal })
      .eq('id', item.id);
  }
}

export async function handleGetResults(req, res) {
  const action = req.query.action || '';

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*');

    if (error) throw error;

    if (action === 'stations') {
      const stationMap = {};

      // Capture most recent entry for each station
      for (let i = data.length - 1; i >= 0; i--) {
        const row = data[i];
        const stationNum = String(row.station || '').trim();

        if (stationNum && stationNum !== '-' && !stationMap[stationNum]) {
          stationMap[stationNum] = {
            Event: row.event,
            Round: row.round,
            Rank: row.rank,
            CompetitorID: row.competitor_id,
            Name: row.name,
            Grade: row.grade,
            Solve1: row.solve1,
            Solve2: row.solve2,
            Solve3: row.solve3,
            Average: row.average,
            Best: row.best,
            Status: row.status,
            Station: stationNum
          };
        }
      }

      return res.status(200).json({ success: true, stations: stationMap });
    }

    const results = data.map(row => ({
      Event: row.event,
      Round: row.round,
      Rank: row.rank,
      CompetitorID: row.competitor_id,
      Name: row.name,
      Grade: row.grade,
      Solve1: row.solve1,
      Solve2: row.solve2,
      Solve3: row.solve3,
      Average: row.average,
      Best: row.best,
      Status: row.status,
      Station: row.station || '-'
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handlePostResults(req, res) {
  try {
    const data = req.body || {};

    if (data.action === 'submitResult') {
      const targetEvent = String(data.Event || '').trim();
      const targetRound = String(data.Round || '').trim();
      const targetCompID = String(data.CompetitorID || '').trim();

      // Check for existing competitor submission in the same Event and Round
      const { data: existing } = await supabase
        .from('results')
        .select('id')
        .eq('event', targetEvent)
        .eq('round', targetRound)
        .eq('competitor_id', targetCompID)
        .maybeSingle();

      const payload = {
        event: targetEvent,
        round: targetRound,
        rank: 0,
        competitor_id: targetCompID,
        name: data.Name || '',
        grade: data.Grade || '',
        solve1: data.Solve1 || '-',
        solve2: data.Solve2 || '-',
        solve3: data.Solve3 || '-',
        average: data.Average || '-',
        best: data.Best || '-',
        status: data.Status || 'Complete',
        station: parseInt(data.Station || data.StationNumber || 0, 10) || 0
      };

      if (existing) {
        await supabase
          .from('results')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('results')
          .insert([payload]);
      }

      // Recalculate ranks asynchronously
      await recalculateRanks(targetEvent, targetRound);

      return res.status(200).json({ success: true, message: 'Result saved successfully' });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGetResults(req, res);
  if (req.method === 'POST') return handlePostResults(req, res);
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
