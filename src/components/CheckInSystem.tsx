import { useState, useEffect } from 'react';
import { supabase, Event, CheckIn } from '../lib/supabaseClient';
import QRCode from 'qrcode';
import { Scanner } from '@yudiel/react-qr-scanner';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

interface CheckInSystemProps {
  user: User;
}

export default function CheckInSystem({ user }: CheckInSystemProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<Record<string, string>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserEvents();
    fetchUserCheckIns();
  }, [user.id]);

  // Auto check-in if opened with ?event_id=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const eventId = params.get('event_id');
    if (eventId) {
      // Attempt check-in once events are loaded
      const tryCheck = async () => {
        if (events.length === 0) return;
        const ev = events.find(e => e.id === eventId);
        if (ev && canCheckIn(ev) && !isCheckedIn(ev.id)) {
          await checkInToEvent(ev.id, 25);
          // Clean URL after check-in
          navigate('/checkin', { replace: true });
        }
      };
      tryCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, events]);

  const fetchUserEvents = async () => {
    try {
      // Get events user has RSVP'd to
      const { data: rsvps, error: rsvpError } = await supabase
        .from('event_rsvps')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'confirmed');

      if (rsvpError) throw rsvpError;

      if (rsvps && rsvps.length > 0) {
        const eventIds = rsvps.map(rsvp => rsvp.event_id);
        
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .order('starts_at', { ascending: true });

        if (eventsError) throw eventsError;
        setEvents(events || []);
      }
    } catch (error) {
      console.error('Error fetching user events:', error);
    }
  };

  const fetchUserCheckIns = async () => {
    try {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setCheckIns(data || []);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkInToEvent = async (eventId: string, pointsOverride?: number) => {
    try {
      // Check if already checked in
      const existingCheckIn = checkIns.find(checkIn => checkIn.event_id === eventId);
      if (existingCheckIn) {
        alert('You have already checked in to this event!');
        return;
      }

      // Award points for check-in
      const pointsAwarded = pointsOverride ?? 25;

      // Create check-in record
      const { data: checkIn, error: checkInError } = await supabase
        .from('checkins')
        .insert([{
          user_id: user.id,
          event_id: eventId,
          points_awarded: pointsAwarded,
        }])
        .select()
        .single();

      if (checkInError) throw checkInError;

      // Update user's reward wallet
      const { data: wallet, error: walletFetchError } = await supabase
        .from('reward_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletFetchError && walletFetchError.code !== 'PGRST116') {
        throw walletFetchError;
      }

      if (wallet) {
        // Update existing wallet
        const { error: walletUpdateError } = await supabase
          .from('reward_wallets')
          .update({
            points_balance: wallet.points_balance + pointsAwarded,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (walletUpdateError) throw walletUpdateError;
      } else {
        // Create new wallet
        const { error: walletCreateError } = await supabase
          .from('reward_wallets')
          .insert([{
            user_id: user.id,
            points_balance: pointsAwarded,
          }]);

        if (walletCreateError) throw walletCreateError;
      }

      setCheckIns([...checkIns, checkIn]);
      alert(`Successfully checked in! You earned ${pointsAwarded} points.`);
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Failed to check in. Please try again.');
    }
  };

  const generateQrForEvent = async (eventId: string) => {
    try {
      const url = `${window.location.origin}/checkin?event_id=${encodeURIComponent(eventId)}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 });
      setQrData(prev => ({ ...prev, [eventId]: dataUrl }));
    } catch (err) {
      console.error('Failed generating QR:', err);
      alert('Failed to generate QR code');
    }
  };

  const handleScanDecode = async (text: string) => {
    try {
      setScanning(true);
      const url = new URL(text);
      const scannedEventId = url.searchParams.get('event_id');
      if (!scannedEventId) throw new Error('Invalid QR code');

      // We might not have the event in list (if user not RSVP'd). Attempt direct check-in with override points.
      await checkInToEvent(scannedEventId, 25);
    } catch (e) {
      console.error(e);
      alert('Invalid code or unable to check in.');
    } finally {
      setScanning(false);
      setShowScanner(false);
    }
  };

  const handleScan = async (detected: IDetectedBarcode[]) => {
    if (!detected || detected.length === 0) return;
    const text = detected[0]?.rawValue;
    if (typeof text === 'string' && text.length > 0) {
      await handleScanDecode(text);
    }
  };

  const isCheckedIn = (eventId: string) => {
    return checkIns.some(checkIn => checkIn.event_id === eventId);
  };

  const isEventActive = (event: Event) => {
    const now = new Date();
    const startTime = new Date(event.starts_at);
    const endTime = new Date(event.ends_at);
    return now >= startTime && now <= endTime;
  };

  const canCheckIn = (event: Event) => {
    const now = new Date();
    const startTime = new Date(event.starts_at);
    const endTime = new Date(event.ends_at);
    // Allow check-in 30 minutes before start and during the event
    const checkInStart = new Date(startTime.getTime() - 30 * 60 * 1000);
    return now >= checkInStart && now <= endTime;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Event Check-In</h2>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No events to check in to. RSVP to events first!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scanner controls */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-gray-900">Scan a QR Code</h3>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 text-sm"
              >
                {showScanner ? 'Hide Scanner' : 'Open Scanner'}
              </button>
            </div>
            {showScanner && (
              <div className="mt-3">
                <Scanner
                  onScan={handleScan}
                  onError={(err: unknown) => console.error(err)}
                />
                {scanning && <p className="text-sm text-gray-500 mt-2">Processing...</p>}
              </div>
            )}
          </div>

          {events.map((event) => (
            <div key={event.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{event.title}</h3>
                  {event.description && (
                    <p className="text-gray-600 mb-3">{event.description}</p>
                  )}
                  
                  <div className="space-y-1 text-sm text-gray-500">
                    {event.location && (
                      <p><span className="font-medium">Location:</span> {event.location}</p>
                    )}
                    <p><span className="font-medium">Start:</span> {new Date(event.starts_at).toLocaleString()}</p>
                    <p><span className="font-medium">End:</span> {new Date(event.ends_at).toLocaleString()}</p>
                  </div>

                  <div className="mt-3">
                    {isEventActive(event) && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Event Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="ml-6 flex flex-col items-end space-y-2">
                  {isCheckedIn(event.id) ? (
                    <div className="text-center">
                      <span className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-green-100 text-green-800">
                        ✓ Checked In
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Earned {checkIns.find(c => c.event_id === event.id)?.points_awarded || 0} points
                      </p>
                    </div>
                  ) : canCheckIn(event) ? (
                    <button
                      onClick={() => checkInToEvent(event.id, 25)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                      Check In (+25 points)
                    </button>
                  ) : (
                    <div className="text-center">
                      <span className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-600">
                        Check-in Unavailable
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date() < new Date(event.starts_at) 
                          ? 'Too early to check in'
                          : 'Event has ended'
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* QR Code section */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Check-in QR</span>
                    <button
                      onClick={() => generateQrForEvent(event.id)}
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded"
                    >
                      {qrData[event.id] ? 'Refresh QR' : 'Generate QR'}
                    </button>
                  </div>
                  {qrData[event.id] && (
                    <div className="mt-2">
                      <img src={qrData[event.id]} alt="Event check-in QR" className="w-40 h-40" />
                      <p className="text-xs text-gray-500 mt-1 break-all">/checkin?event_id={event.id}</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
      {checkIns.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Check-in History</h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {checkIns.map((checkIn) => {
                const event = events.find(e => e.id === checkIn.event_id);
                return (
                  <div key={checkIn.id} className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {event?.title || 'Unknown Event'}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Checked in on {new Date(checkIn.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-green-600 font-medium">
                        +{checkIn.points_awarded} points
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
