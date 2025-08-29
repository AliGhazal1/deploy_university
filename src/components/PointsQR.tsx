import { useState } from 'react';
import QRCode from 'qrcode';

interface PointsQRProps {
  points: number;
  title: string;
}

export default function PointsQR({ points, title }: PointsQRProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateQR = async () => {
    setLoading(true);
    try {
      // Create QR code URL that the scanner can recognize as points
      const qrData = `${window.location.origin}/check-in?type=points&points=${points}&title=${encodeURIComponent(title)}`;
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Points QR Code - ${title}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
                margin: 0;
              }
              .qr-container { 
                max-width: 400px; 
                margin: 0 auto;
                border: 2px solid #333;
                padding: 20px;
                border-radius: 10px;
              }
              .title { 
                font-size: 24px; 
                font-weight: bold; 
                margin-bottom: 10px;
                color: #333;
              }
              .points { 
                font-size: 20px; 
                color: #4F46E5; 
                margin-bottom: 20px;
                font-weight: bold;
              }
              .qr-code { 
                margin: 20px 0;
              }
              .instructions {
                font-size: 14px;
                color: #666;
                margin-top: 15px;
                line-height: 1.4;
              }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="title">${title}</div>
              <div class="points">+${points} Points</div>
              <div class="qr-code">
                <img src="${qrCodeUrl}" alt="QR Code" />
              </div>
              <div class="instructions">
                Scan this QR code with the Campus Connect app to earn ${points} points
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
    <div className="bg-white border rounded-lg p-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Points QR Code</h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate QR code for <span className="font-semibold text-indigo-600">+{points} points</span>
        </p>
        
        {!qrCodeUrl ? (
          <button
            onClick={generateQR}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate QR Code'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={qrCodeUrl} alt="Points QR Code" className="border rounded" />
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={printQR}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
              >
                Print QR Code
              </button>
              <button
                onClick={generateQR}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
              >
                Regenerate
              </button>
            </div>
            
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <p><strong>Instructions:</strong></p>
              <p>1. Print this QR code</p>
              <p>2. Display it where users can scan</p>
              <p>3. Users scan to earn {points} points</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
