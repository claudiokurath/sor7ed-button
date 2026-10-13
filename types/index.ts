export interface SavedItem {
  id: string;
  shortId: string;
  userId: string;
  url: string;
  title: string;
  imageUrl: string | null;
  cachedImageUrl: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  reminderAt: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  whatsappNumber: string | null;
  whatsappVerified: boolean;
  lastInboundMessageAt: string | null;
}

export interface Partner {
  id: string;
  name: string;
  domain: string;
}

/** Provider acceptance is not proof of delivery to the recipient's device. */
export type SaveDeliveryStatus = 'pending' | 'accepted' | 'failed' | 'skipped' | 'unknown';

export interface SaveResponse {
  shortId: string;
  cardUrl: string;
  saveStatus: 'saved';
  deliveryStatus: SaveDeliveryStatus;
  deliveryReason: string | null;
}
