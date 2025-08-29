import { RewardRedemption } from '../lib/supabaseClient';

interface RedemptionListProps {
  redemptions: RewardRedemption[];
  loading?: boolean;
}

export default function RedemptionList({ redemptions, loading }: RedemptionListProps) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="text-right">
                  <div className="h-6 bg-gray-200 rounded w-20 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (redemptions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No redemptions yet</h3>
          <p className="text-gray-500">Start redeeming coupons to see your history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Redemption History</h3>
        <p className="text-sm text-gray-500">Your redeemed coupons and codes</p>
      </div>
      <div className="divide-y divide-gray-200">
        {redemptions.map((redemption) => (
          <div key={redemption.id} className="p-6 hover:bg-gray-50 transition-colors duration-150">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="text-lg font-medium text-gray-900 mb-1">
                  {(redemption as any).reward_coupons?.title || 'Unknown Coupon'}
                </h4>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Vendor:</span> {(redemption as any).reward_coupons?.vendor || 'Unknown'}
                </p>
                <p className="text-sm text-gray-500">
                  Redeemed on {new Date(redemption.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              <div className="text-right ml-4">
                <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-md text-sm font-mono mb-2 border">
                  <div className="text-xs text-gray-500 mb-1">Redemption Code</div>
                  <div className="font-semibold tracking-wider">{redemption.redemption_code}</div>
                </div>
                <p className="text-sm text-red-600 font-medium">
                  -{redemption.points_spent} points
                </p>
              </div>
            </div>
            
            {(redemption as any).reward_coupons?.description && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  {(redemption as any).reward_coupons.description}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
