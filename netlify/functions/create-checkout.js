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
    const { plan, seats, promoCode, trialDays } = JSON.parse(event.body);

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
      annual: 'price_1SPX65AE1fARVUOGHdYCaKXD'
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
      client_reference_id: `govtribe_${plan}_${quantity}_${Date.now()}`,
      // Require customer information
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true
      },
      // Enable automatic tax calculation
      automatic_tax: {
        enabled: true
      },
      // Collect company name as custom field
      custom_fields: [
        {
          key: 'company',
          label: {
            type: 'custom',
            custom: 'Company Name'
          },
          type: 'text',
          optional: false
        }
      ]
    };

    // Add trial period if specified
    if (trialDays && trialDays > 0) {
      sessionConfig.subscription_data = {
        trial_period_days: trialDays
      };
    }

    // No promo code needed - discount is already built into the price

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
    console.error('Error details:', JSON.stringify(error, null, 2));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        message: error.message,
        type: error.type,
        code: error.code,
        details: error.raw?.message || error.toString()
      })
    };
  }
};
