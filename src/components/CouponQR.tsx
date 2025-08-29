import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Loader2, Printer, RefreshCw, QrCode as QrIcon } from 'lucide-react';

interface CouponQRProps {
  couponId: string;
  couponTitle: string;
  pointsRequired: number;
}

export default function CouponQR({ couponId, couponTitle, pointsRequired }: CouponQRProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateQRCode();
  }, [couponId]);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      
      // Create QR code URL for coupon redemption
      const redemptionUrl = `${window.location.origin}/redeem?coupon_id=${encodeURIComponent(couponId)}&type=coupon`;
      
      const qrDataUrl = await QRCode.toDataURL(redemptionUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Coupon QR Code - ${couponTitle}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .no-print { display: none; }
            }
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            .qr-container { border: 2px solid #333; padding: 20px; margin: 20px auto; max-width: 400px; }
            .qr-code { margin: 20px 0; }
            .coupon-info { margin: 15px 0; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .points { font-size: 18px; color: #666; margin-bottom: 15px; }
            .instructions { font-size: 14px; color: #888; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="title">${couponTitle}</div>
            <div class="points">Worth ${pointsRequired} Points</div>
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="Coupon QR Code" />
            </div>
            <div class="instructions">
              Scan this QR code to redeem your coupon and earn ${pointsRequired} points!
            </div>
          </div>
          <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">Print QR Code</button>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        <span className="ml-2 text-gray-400">Generating QR code...</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 max-w-md mx-auto border border-gray-700/50">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <QrIcon className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-gray-100">{couponTitle}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">Worth {pointsRequired} Points</p>
        
        <div className="bg-white rounded-lg p-4 mb-4">
          <img 
            src={qrCodeUrl} 
            alt="Coupon QR Code" 
            className="mx-auto"
            style={{ maxWidth: '250px', height: 'auto' }}
          />
        </div>
        
        <p className="text-xs text-gray-500 mb-4">
          Scan this QR code to redeem coupon and earn {pointsRequired} points
        </p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={handlePrint}
            className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-violet-600 hover:to-purple-600 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-violet-500/25 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print QR Code
          </button>
          <button
            onClick={generateQRCode}
            className="bg-gray-700/50 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium transition-all duration-200 border border-gray-600/50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
