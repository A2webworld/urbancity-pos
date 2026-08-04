// netlify/functions/monnify-webhook.js
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Only allow POST requests from Monnify
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const signature = event.headers['x-mp-signature'];

    // 1. Verify webhook signature (security)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.MONNIFY_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('❌ Invalid webhook signature');
      return { statusCode: 401, body: 'Invalid signature' };
    }

    // 2. Process the transaction event
    const eventType = payload.eventType;
    const transaction = payload.eventData;

    console.log(`📩 Webhook received: ${eventType}`);

    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      // Payment was successful!
      const paymentReference = transaction.paymentReference;
      const amount = transaction.amount;
      const customerName = transaction.customerName;
      const customerEmail = transaction.customerEmail;
      const paymentMethod = transaction.paymentMethod;

      console.log(`✅ PAYMENT SUCCESSFUL!`);
      console.log(`📋 Reference: ${paymentReference}`);
      console.log(`💰 Amount: ₦${amount}`);
      console.log(`👤 Customer: ${customerName}`);
      console.log(`📧 Email: ${customerEmail}`);
      console.log(`💳 Method: ${paymentMethod}`);

      // ============================================================
      // SUPABASE INTEGRATION - UPDATE ORDER STATUS
      // ============================================================
      try {
        // Initialize Supabase client
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        // Update the order in Supabase
        const { data, error } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_reference: paymentReference,
            payment_method: paymentMethod,
            paid_at: new Date().toISOString()
          })
          .eq('order_number', paymentReference);

        if (error) {
          console.error('❌ Supabase update error:', error);
        } else {
          console.log(`✅ Order ${paymentReference} updated to PAID in Supabase`);
        }

        // ============================================================
        // OPTIONAL: Send WhatsApp notification to restaurant
        // ============================================================
        // You can add code here to send a WhatsApp message to the restaurant
        // using the restaurant WhatsApp number: 2348105442629

        // ============================================================
        // OPTIONAL: Send email receipt to customer
        // ============================================================
        // You can add code here to send a receipt email to the customer

      } catch (supabaseError) {
        console.error('❌ Supabase error:', supabaseError);
        // Don't throw - we still want to return 200 to Monnify
      }

    } else if (eventType === 'FAILED_TRANSACTION') {
      console.log(`❌ Payment FAILED for reference: ${transaction.paymentReference}`);
      
      // Optional: Update order status to 'failed' in Supabase
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        const { error } = await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            payment_reference: transaction.paymentReference
          })
          .eq('order_number', transaction.paymentReference);

        if (error) {
          console.error('❌ Supabase update error:', error);
        } else {
          console.log(`✅ Order ${transaction.paymentReference} updated to FAILED`);
        }
      } catch (supabaseError) {
        console.error('❌ Supabase error:', supabaseError);
      }

    } else {
      console.log(`ℹ️ Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Still return 200 to prevent Monnify from retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, error: error.message })
    };
  }
};