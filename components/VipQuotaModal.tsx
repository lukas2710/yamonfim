'use client';

import QuotaUnlockModal from './QuotaUnlockModal';

export default function VipQuotaModal({ onClose }: { onClose: () => void }) {
  return <QuotaUnlockModal onClose={onClose} />;
}
