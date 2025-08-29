import { RewardCoupon } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import QRCode from 'qrcode';

interface CouponCardProps {
  coupon: RewardCoupon;
  userBalance: number;
  isAdmin: boolean;
}

export default function CouponCard({ coupon, userBalance, isAdmin }: CouponCardProps) {
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateCouponQR = async () => {
    setLoading(true);
    try {
      // Create QR code URL for coupon redemption
      const qrData = `${window.location.origin}/check-in?type=coupon&coupon_id=${coupon.id}&title=${encodeURIComponent(coupon.title)}`;
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
            <title>Coupon QR Code - ${coupon.title}</title>
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
                color: #DC2626; 
                margin-bottom: 20px;
                font-weight: bold;
              }
              .vendor {
                font-size: 16px;
                color: #666;
                margin-bottom: 15px;
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
              <div class="title">${coupon.title}</div>
              <div class="vendor">${coupon.vendor}</div>
              <div class="points">Costs ${coupon.points_required} Points</div>
              <div class="qr-code">
                <img src="${qrCodeUrl}" alt="Coupon QR Code" />
              </div>
              <div class="instructions">
                Scan this QR code with the Campus Connect app to redeem this coupon
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const formatDiscount = (coupon: RewardCoupon) => {
    if (coupon.discount_percentage) {
      return `${coupon.discount_percentage}% off`;
    } else if (coupon.discount_amount) {
      return `$${(coupon.discount_amount / 100).toFixed(2)} off`;
    }
    return 'Special offer';
  };

  const isExpired = coupon.expiry_date && new Date(coupon.expiry_date) < new Date();
  const canAfford = userBalance >= coupon.points_required;
  const canRedeem = !isExpired && canAfford && coupon.is_active;

  return (
    <div className={`bg-white shadow rounded-lg p-6 border-l-4 transition-all duration-200 hover:shadow-md ${
      canRedeem ? 'border-indigo-500' : 'border-gray-300 opacity-75'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-lg font-medium text-gray-900 line-clamp-2">{coupon.title}</h4>
        <span className={`text-xs font-medium px-2 py-1 rounded ${
          canRedeem ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {formatDiscount(coupon)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-2">
        <span className="font-medium">Vendor:</span> {coupon.vendor}
      </p>
      
      {coupon.description && (
        <p className="text-gray-600 mb-4 text-sm line-clamp-3">{coupon.description}</p>
      )}
      
      <div className="flex justify-between items-center mb-3">
        <span className={`text-sm font-medium ${
          canAfford ? 'text-indigo-600' : 'text-red-500'
        }`}>
          {coupon.points_required} points
        </span>
        
        {!canAfford && (
          <span className="text-xs text-red-500">
            Need {coupon.points_required - userBalance} more points
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {isAdmin ? (
          <button
            onClick={() => {
              setShowQR(!showQR);
              if (!showQR && !qrCodeUrl) {
                generateCouponQR();
              }
            }}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50"
          >
            {loading ? 'Generating...' : showQR ? 'Hide QR' : 'Generate QR'}
          </button>
        ) : (
          <Link
            to="/check-in"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              canRedeem 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={canRedeem ? undefined : (e) => e.preventDefault()}
          >
            {canRedeem ? 'Redeem' : 'Insufficient Points'}
          </Link>
        )}
      </div>

      {/* Admin QR Generation */}
      {isAdmin && showQR && qrCodeUrl && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={qrCodeUrl} alt="Coupon QR Code" className="border rounded" />
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={printQR}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
              >
                Print QR Code
              </button>
              <button
                onClick={generateCouponQR}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
              >
                Regenerate
              </button>
            </div>
            
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <p><strong>Instructions:</strong></p>
              <p>1. Print this QR code</p>
              <p>2. Display it where users can scan</p>
              <p>3. Users scan to redeem coupon for {coupon.points_required} points</p>
            </div>
          </div>
        </div>
      )}
      
      {coupon.expiry_date && (
        <p className={`text-xs mt-2 ${
          isExpired ? 'text-red-500' : 'text-gray-500'
        }`}>
          {isExpired ? 'Expired' : 'Expires'}: {new Date(coupon.expiry_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
