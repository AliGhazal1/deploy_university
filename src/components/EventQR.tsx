import { useState, useRef } from 'react';
import QRCode from 'qrcode';

interface EventQRProps {
  eventId: string;
  eventTitle?: string;
  baseUrl?: string;
}

export default function EventQR({ eventId, eventTitle, baseUrl }: EventQRProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  const generateQR = async () => {
    setLoading(true);
    setError('');
    
    try {
      const url = `${baseUrl || window.location.origin}/checkin?event_id=${encodeURIComponent(eventId)}`;
      const dataUrl = await QRCode.toDataURL(url, { 
        width: 400, 
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrDataUrl) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Event Check-in QR Code</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
              }
              .qr-container {
                text-align: center;
                border: 2px solid #000;
                padding: 30px;
                border-radius: 10px;
                background: white;
              }
              .qr-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #333;
              }
              .qr-subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 20px;
              }
              .qr-code {
                margin: 20px 0;
              }
              .qr-instructions {
                font-size: 14px;
                color: #888;
                margin-top: 20px;
                max-width: 400px;
              }
              .qr-url {
                font-size: 12px;
                color: #999;
                margin-top: 10px;
                word-break: break-all;
              }
              @media print {
                body { margin: 0; }
                .qr-container { border: 2px solid #000; }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="qr-title">Event Check-in</div>
              <div class="qr-subtitle">${eventTitle || 'Campus Event'}</div>
              <div class="qr-code">
                <img src="${qrDataUrl}" alt="Event Check-in QR Code" style="width: 300px; height: 300px;" />
              </div>
              <div class="qr-instructions">
                Scan this QR code with your phone to check in to the event and earn 25 points!
              </div>
              <div class="qr-url">
                ${window.location.origin}/checkin?event_id=${eventId}
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          QR Code Generator
        </h3>
        
        {eventTitle && (
          <p className="text-sm text-gray-600 mb-4">
            Generate a printable QR code for: <span className="font-medium">{eventTitle}</span>
          </p>
        )}

        {!qrDataUrl ? (
          <button
            onClick={generateQR}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating QR Code...
              </div>
            ) : (
              'Generate QR Code'
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-gray-200 rounded-lg p-4 inline-block">
              <img 
                src={qrDataUrl} 
                alt="Event Check-in QR Code" 
                className="w-64 h-64 mx-auto"
              />
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p>Scan this QR code to check in and earn 25 points!</p>
              <p className="font-mono text-xs break-all bg-gray-100 p-2 rounded">
                {window.location.origin}/checkin?event_id={eventId}
              </p>
            </div>

            <div className="flex space-x-3 justify-center">
              <button
                onClick={handlePrint}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print QR Code
              </button>
              
              <button
                onClick={generateQR}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
