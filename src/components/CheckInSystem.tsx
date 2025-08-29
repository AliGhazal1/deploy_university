import { useState, useEffect } from 'react';
import { supabase, Event, CheckIn } from '../lib/supabaseClient';
import QRCode from 'qrcode';
import { Scanner } from '@yudiel/react-qr-scanner';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { QrCode, MapPin, Clock, CheckCircle, Calendar, Award, History, Camera, AlertCircle, Loader2 } from 'lucide-react';

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
  const [cameraError, setCameraError] = useState<string>('');
  const [checkInMessage, setCheckInMessage] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserEvents();
    fetchUserCheckIns();
    setShowScanner(true);
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
          navigate('/check-in', { replace: true });
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
      // Don't show error to user for check-ins fetch, just log it
    } finally {
      setLoading(false);
    }
  };

  const handleScanError = (error: unknown) => {
    console.error('QR Scanner error:', error);
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera and refresh the page.');
      } else if (error.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions and refresh.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is being used by another application.');
      } else {
        setCameraError('Camera error: ' + error.message);
      }
    } else {
      setCameraError('Unknown camera error occurred.');
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
            points: wallet.points + pointsAwarded,
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
            points: pointsAwarded,
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
      const url = `${window.location.origin}/check-in?event_id=${encodeURIComponent(eventId)}`;
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
      const couponId = url.searchParams.get('coupon_id');
      const type = url.searchParams.get('type');
      const points = url.searchParams.get('points');
      const title = url.searchParams.get('title');

      if (type === 'points' && points) {
        // Handle points QR code
        await awardPoints(parseInt(points), title || 'Points Award');
      } else if (type === 'coupon' && couponId) {
        await redeemCouponQR(couponId);
      } else if (scannedEventId) {
        await checkInToEvent(scannedEventId, 25);
      } else {
        throw new Error('Invalid QR code format');
      }
    } catch (e) {
      console.error(e);
      setCheckInMessage({
        type: 'error',
        message: 'Invalid QR code or unable to process scan.'
      });
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

  const awardPoints = async (points: number, title: string) => {
    try {
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
            points: wallet.points + points,
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
            points: points,
          }]);

        if (walletCreateError) throw walletCreateError;
      }

      setCheckInMessage({
        type: 'success',
        message: `✅ ${title} successful! You earned ${points} points!`
      });
    } catch (error) {
      console.error('Error awarding points:', error);
      setCheckInMessage({
        type: 'error',
        message: 'Failed to award points.'
      });
    }
  };

  const redeemCouponQR = async (couponId: string) => {
    try {
      const { data, error } = await supabase.rpc('redeem_coupon', {
        p_user: user.id,
        p_coupon: parseInt(couponId)
      });

      if (error) throw error;

      if (data?.success) {
        setCheckInMessage({
          type: 'success',
          message: `✅ Coupon redeemed successfully! You spent ${data.points_spent} points.`
        });
      } else {
        throw new Error(data?.error || 'Failed to redeem coupon');
      }
    } catch (error: any) {
      console.error('Error redeeming coupon:', error);
      setCheckInMessage({
        type: 'error',
        message: `Failed to redeem coupon: ${error.message}`
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-8 flex items-center gap-3">
        <QrCode className="w-8 h-8 text-violet-400" />
        Event Check-In
      </h2>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-16 w-16 text-gray-500 mb-4">
            <Calendar className="w-full h-full" />
          </div>
          <h3 className="text-xl font-semibold text-gray-200 mb-2">No events to check in to</h3>
          <p className="text-gray-400 mb-8">RSVP to events first to see them here!</p>
          
          {/* QR Scanner for events not in list */}
          <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6 max-w-md mx-auto">
            <div className="text-center">
              <h4 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">Have a QR Code?</h4>
              <p className="text-sm text-gray-400 mb-4">Scan any event QR code to check in and earn points</p>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className="w-full sm:w-auto bg-gradient-to-r from-violet-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-violet-600 hover:to-purple-600 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2 mx-auto"
              >
                <Camera className="w-4 h-4" />
                {showScanner ? 'Hide Scanner' : 'Scan QR Code'}
              </button>
            </div>
            
            {showScanner && (
              <div className="mt-6">
                <div className="max-w-sm mx-auto bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                  <Scanner
                    onScan={handleScan}
                    onError={handleScanError}
                  />
                </div>
                {scanning && (
                  <div className="flex items-center justify-center mt-3">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin mr-2" />
                    <p className="text-sm text-gray-400">Processing scan...</p>
                  </div>
                )}
                {cameraError && (
                  <div className="text-red-400 mt-3 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {cameraError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Enhanced Scanner controls */}
          <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Camera className="w-5 h-5 text-cyan-400" />
                  QR Code Scanner
                </h3>
                <p className="text-sm text-gray-400 mt-1">Scan event QR codes to check in instantly and earn 25 points</p>
              </div>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2 ${
                  showScanner 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 hover:shadow-red-500/25' 
                    : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 hover:shadow-violet-500/25'
                }`}
              >
                <Camera className="w-4 h-4" />
                {showScanner ? 'Hide Scanner' : 'Open Scanner'}
              </button>
            </div>
            
            {/* Status Messages */}
            {checkInMessage && (
              <div className={`mb-4 p-4 rounded-xl border backdrop-blur-sm ${
                checkInMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
                checkInMessage.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' :
                'bg-red-500/10 border-red-500/50 text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  {checkInMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{checkInMessage.message}</span>
                </div>
              </div>
            )}
            
            {showScanner && (
              <div className="border-2 border-dashed border-gray-600/50 rounded-xl p-4 bg-gray-900/30">
                <div className="max-w-sm mx-auto bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                  <Scanner
                    onScan={handleScan}
                    onError={handleScanError}
                  />
                </div>
                <div className="text-center mt-3">
                  {scanning ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-violet-400 animate-spin mr-2" />
                      <p className="text-sm text-gray-400 font-medium">Processing scan...</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Point your camera at a QR code</p>
                  )}
                </div>
                {cameraError && (
                  <div className="text-red-400 mt-3 text-sm flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {cameraError}
                  </div>
                )}
              </div>
            )}
          </div>

          {events.map((event) => (
            <div key={event.id} className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl p-6 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-100 mb-3">{event.title}</h3>
                  {event.description && (
                    <p className="text-gray-400 mb-4">{event.description}</p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {event.location && (
                      <p className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        <span>{event.location}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span>Start: {new Date(event.starts_at).toLocaleString()}</span>
                    </p>
                    <p className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4 text-red-400" />
                      <span>End: {new Date(event.ends_at).toLocaleString()}</span>
                    </p>
                  </div>

                  <div className="mt-4">
                    {isEventActive(event) && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                        Event Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="ml-6 flex flex-col items-end space-y-3">
                  {isCheckedIn(event.id) ? (
                    <div className="text-center">
                      <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Checked In
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        Earned {checkIns.find(c => c.event_id === event.id)?.points_awarded || 0} points
                      </p>
                    </div>
                  ) : canCheckIn(event) ? (
                    <button
                      onClick={() => checkInToEvent(event.id, 25)}
                      className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-5 py-2.5 rounded-xl hover:from-violet-600 hover:to-purple-600 shadow-lg hover:shadow-violet-500/25 transition-all duration-200 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Check In (+25 pts)
                    </button>
                  ) : (
                    <div className="text-center">
                      <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-gray-700/50 text-gray-400 border border-gray-600/50">
                        Check-in Unavailable
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date() < new Date(event.starts_at) 
                          ? 'Too early to check in'
                          : 'Event has ended'
                        }
                      </p>
                    </div>
                  )}

                  {/* QR Code section */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Check-in QR</span>
                      <button
                        onClick={() => generateQrForEvent(event.id)}
                        className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg transition-colors duration-200"
                      >
                        {qrData[event.id] ? 'Refresh' : 'Generate'}
                      </button>
                    </div>
                    {qrData[event.id] && (
                      <div className="bg-white p-2 rounded-lg">
                        <img src={qrData[event.id]} alt="Event check-in QR" className="w-32 h-32" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {checkIns.length > 0 && (
            <div className="mt-8">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-6 flex items-center gap-2">
                <History className="w-6 h-6 text-cyan-400" />
                Check-in History
              </h3>
              <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700/50 shadow-xl rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-700/50">
                  {checkIns.map((checkIn) => {
                    const event = events.find(e => e.id === checkIn.event_id);
                    return (
                      <div key={checkIn.id} className="p-4 flex justify-between items-center hover:bg-gray-700/20 transition-colors duration-200">
                        <div>
                          <h4 className="font-medium text-gray-100">
                            {event?.title || 'Unknown Event'}
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            Checked in on {new Date(checkIn.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <Award className="w-4 h-4" />
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
