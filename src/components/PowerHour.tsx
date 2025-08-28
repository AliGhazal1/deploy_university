import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Zap, Trophy, Camera } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

const PowerHour: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [points, setPoints] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const captureAndProcessQR = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // Simulate QR code detection (in real app, use a QR library like jsQR)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Mock QR detection - replace with actual QR library
    const mockQRDetected = Math.random() > 0.7; // 30% chance for demo
    
    if (mockQRDetected) {
      await handleQRSuccess();
    }
  };

  const handleQRSuccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert power hour record
      const { error: powerHourError } = await supabase
        .from('power_hour')
        .insert({
          user_id: user.id,
          points_awarded: 25
        });

      if (powerHourError) throw powerHourError;

      // Update user points
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          points: supabase.sql`points + 25` 
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setPoints(prev => prev + 25);
      stopScanning();

      toast({
        title: "Success! 🎉",
        description: "You've earned 25 points!",
      });

    } catch (error) {
      console.error('Error processing QR scan:', error);
      toast({
        title: "Error",
        description: "Failed to process QR code. Please try again.",
        variant: "destructive"
      });
    }
  };

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (scanning) {
      interval = setInterval(captureAndProcessQR, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanning]);

  React.useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('points')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setPoints(data?.points || 0);
      } catch (error) {
        console.error('Error fetching points:', error);
      }
    };

    fetchUserPoints();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center">
            <Zap className="mr-3 text-yellow-500" size={40} />
            Power Hour
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Join focused study sessions and earn points by scanning QR codes
          </p>

          <div className="flex items-center justify-center space-x-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">{points}</div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">+25</div>
              <div className="text-sm text-gray-600">Points per Scan</div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Scanner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center">
                  <QrCode className="mr-2" size={24} />
                  QR Scanner
                </CardTitle>
                <CardDescription>
                  Scan QR codes at Power Hour locations to earn points
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="relative mb-6">
                  {scanning ? (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        className="w-full h-64 object-cover rounded-lg border-2 border-yellow-300"
                        playsInline
                      />
                      <div className="absolute inset-0 border-2 border-yellow-400 rounded-lg">
                        <div className="absolute top-4 left-4 w-8 h-8 border-l-4 border-t-4 border-yellow-400"></div>
                        <div className="absolute top-4 right-4 w-8 h-8 border-r-4 border-t-4 border-yellow-400"></div>
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-4 border-b-4 border-yellow-400"></div>
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-4 border-b-4 border-yellow-400"></div>
                      </div>
                      <motion.div
                        className="absolute inset-x-0 top-1/2 h-0.5 bg-yellow-400"
                        animate={{ y: [-50, 50, -50] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <div className="text-center">
                        <Camera size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Camera preview will appear here</p>
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={scanning ? stopScanning : startScanning}
                    size="lg"
                    className={`w-full ${
                      scanning 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                  >
                    {scanning ? (
                      <>
                        <QrCode className="mr-2" size={20} />
                        Stop Scanning
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2" size={20} />
                        Start Scanning
                      </>
                    )}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Instructions & Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="mr-2 text-yellow-500" size={24} />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <p className="text-sm text-gray-600">
                    Find a Power Hour session happening on campus
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <p className="text-sm text-gray-600">
                    Tap "Start Scanning" and point your camera at the QR code
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <p className="text-sm text-gray-600">
                    Earn 25 points instantly when the QR code is detected
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Power Hour Locations</CardTitle>
                <CardDescription>
                  Find these sessions around campus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">TFDL Study Hall</div>
                      <div className="text-sm text-gray-500">Level 2, Group Study Area</div>
                    </div>
                    <div className="text-green-600 text-sm font-medium">Active</div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">MacEwan Focus Room</div>
                      <div className="text-sm text-gray-500">Room 240</div>
                    </div>
                    <div className="text-green-600 text-sm font-medium">Active</div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Science Library</div>
                      <div className="text-sm text-gray-500">Quiet Study Zone</div>
                    </div>
                    <div className="text-gray-400 text-sm font-medium">Inactive</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PowerHour;
