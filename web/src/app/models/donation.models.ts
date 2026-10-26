export interface Donation {
  id: string; // The push ID
  amount: number;
  donatedAt: string;
  redeemedBy?: string;
  donorName?: string;
  imageUrl?: string;
  isCustomized?: boolean;
  customizedAt?: string;
}
