// Lenco Payment Gateway Integration
// Documentation: https://api.lenco.co/access/v2/collections/mobile-money

const LENCO_API_URL = "https://api.lenco.co/access/v2";
const LENCO_API_KEY = process.env.LENCO_API_KEY || "";

export interface LencoMobileMoneyRequest {
  amount: number;
  reference: string;
  phone: string;
  operator: "airtel" | "mtn" | "tnm";
  country?: "zm" | "mw"; // zm = Zambia, mw = Malawi
  bearer?: "merchant" | "customer";
}

export interface LencoMobileMoneyResponse {
  status: boolean;
  message: string;
  data: {
    id: string;
    initiatedAt: string;
    completedAt: string | null;
    amount: string;
    fee: string | null;
    bearer: "merchant" | "customer";
    currency: string;
    reference: string;
    lencoReference: string;
    type: "mobile-money";
    status: "pending" | "successful" | "failed" | "pay-offline";
    source: "api";
    reasonForFailure: string | null;
    settlementStatus: "pending" | "settled" | null;
    settlement: null;
    mobileMoneyDetails: {
      country: string;
      phone: string;
      operator: string;
      accountName: string | null;
      operatorTransactionId: string | null;
    } | null;
    bankAccountDetails: null;
    cardDetails: null;
  };
}

export interface LencoCollectionStatusResponse {
  status: boolean;
  message: string;
  data: {
    id: string;
    initiatedAt: string;
    completedAt: string | null;
    amount: string;
    fee: string | null;
    bearer: "merchant" | "customer";
    currency: string;
    reference: string;
    lencoReference: string;
    type: "mobile-money";
    status: "pending" | "successful" | "failed" | "pay-offline";
    source: "api";
    reasonForFailure: string | null;
    settlementStatus: "pending" | "settled" | null;
    mobileMoneyDetails: {
      country: string;
      phone: string;
      operator: string;
      accountName: string | null;
      operatorTransactionId: string | null;
    } | null;
  };
}

// Generate a unique reference for the transaction
export function generatePaymentReference(prefix: string = "PAY-SKOOL"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Initiate mobile money collection
export async function initiateMobileMoneyCollection(
  request: LencoMobileMoneyRequest
): Promise<LencoMobileMoneyResponse> {
  if (!LENCO_API_KEY) {
    throw new Error("LENCO_API_KEY is not configured");
  }

  const response = await fetch(`${LENCO_API_URL}/collections/mobile-money`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Bearer ${LENCO_API_KEY}`,
    },
    body: JSON.stringify({
      amount: request.amount,
      reference: request.reference,
      phone: request.phone,
      operator: request.operator,
      country: request.country || "zm", // Default to Zambia
      bearer: request.bearer || "merchant",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to initiate mobile money collection");
  }

  return data;
}

// Check collection status
export async function getCollectionStatus(
  reference: string
): Promise<LencoCollectionStatusResponse> {
  if (!LENCO_API_KEY) {
    throw new Error("LENCO_API_KEY is not configured");
  }

  const response = await fetch(
    `${LENCO_API_URL}/collections/status/${reference}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${LENCO_API_KEY}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get collection status");
  }

  return data;
}

// Supported operators by country
export const MOBILE_MONEY_OPERATORS = {
  zm: [
    { value: "airtel", label: "Airtel Money" },
    { value: "mtn", label: "MTN Mobile Money" },
  ],
  mw: [
    { value: "airtel", label: "Airtel Money" },
    { value: "tnm", label: "TNM Mpamba" },
  ],
};

export const COUNTRIES = [
  { value: "zm", label: "Zambia" },
  { value: "mw", label: "Malawi" },
];
