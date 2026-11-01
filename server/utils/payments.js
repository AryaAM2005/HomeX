import crypto from 'node:crypto';

// The only place that moves money. To move to Razorpay, create the order or subscription
// charge here and return Razorpay's payment id as the reference.
export async function takePayment() {
  return { provider: 'mock', reference: `mock_${crypto.randomUUID()}` };
}

// Razorpay's refund call goes here. It receives the reference from takePayment.
export async function refundPayment() {}
