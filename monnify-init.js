// netlify/functions/monnify-init.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, customerEmail, customerName, orderReference } = JSON.parse(event.body);

    // 1. Get authentication token
    const authResponse = await fetch(`${process.env.MONNIFY_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    const authData = await authResponse.json();
    if (!authData.responseBody?.accessToken) {
      throw new Error('Failed to get access token');
    }

    const token = authData.responseBody.accessToken;

    // 2. Initialize transaction
    const paymentData = {
      amount: amount,
      customerName: customerName,
      customerEmail: customerEmail,
      paymentReference: orderReference || `URBAN-${Date.now()}`,
      paymentDescription: `Order payment for ${customerName}`,
      currencyCode: "NGN",
      contractCode: process.env.MONNIFY_CONTRACT_CODE,
      redirectUrl: `${process.env.SITE_URL}/payment-callback.html`,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
      metadata: {
        customerName: customerName,
        customerEmail: customerEmail
      }
    };

    const initResponse = await fetch(`${process.env.MONNIFY_BASE_URL}/merchant/transactions/init-transaction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const initData = await initResponse.json();

    if (initData.requestSuccessful && initData.responseBody?.checkoutUrl) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          checkoutUrl: initData.responseBody.checkoutUrl,
          paymentReference: paymentData.paymentReference
        })
      };
    } else {
      throw new Error(initData.responseMessage || 'Payment initialization failed');
    }

  } catch (error) {
    console.error('Monnify init error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Payment initialization failed'
      })
    };
  }
};