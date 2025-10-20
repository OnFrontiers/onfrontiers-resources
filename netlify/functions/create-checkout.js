// Netlify serverless function to create Stripe Checkout Session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { plan, seats, promoCode } = JSON.parse(event.body);

    // Validate inputs
    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan. Must be "monthly" or "annual"' })
      };
    }

    const quantity = parseInt(seats);
    if (!quantity || quantity < 1 || quantity > 99) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid seats. Must be between 1 and 99' })
      };
    }

    // Price IDs from Stripe
    const priceIds = {
      monthly: 'price_1SI9mtAE1fARVUOGEa05tboF',
      annual: 'price_1SI9oOAE1fARVUOGj7ov4n22'
    };

    // Get the origin for redirect URLs
    const origin = event.headers.origin || 'https://resources.onfrontiers.com';

    // Create Checkout Session configuration
    const sessionConfig = {
      mode: 'subscription',
      line_items: [
        {
          price: priceIds[plan],
          quantity: quantity
        }
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/govtribe-offer`,
      client_reference_id: `govtribe_${plan}_${quantity}_${Date.now()}`
    };

    // Add promo code if provided and plan is annual
    if (plan === 'annual') {
      // GovTribe exclusive promo code
      sessionConfig.discounts = [{
        promotion_code: 'promo_1SI9z2AE1fARVUOGXb5M7TBq'
      }];
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Return the checkout URL
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: session.url,
        sessionId: session.id
      })
    };

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        message: error.message
      })
    };
  }
};
