module.exports = async function googleReviews(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    console.error('Google Reviews are not configured. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID.');
    return res.status(503).json({ error: 'Google Reviews are not configured.' });
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
        },
      }
    );

    if (!response.ok) {
      console.error(`Google Places API returned status ${response.status}.`);
      return res.status(502).json({ error: 'Google Reviews could not be loaded.' });
    }

    const place = await response.json();
    const reviews = Array.isArray(place.reviews)
      ? place.reviews.slice(0, 3).map((review) => ({
          authorName: review.authorAttribution?.displayName || '',
          authorUrl: review.authorAttribution?.uri || '',
          rating: review.rating,
          text: review.text?.text || review.originalText?.text || '',
          relativeTime: review.relativePublishTimeDescription || '',
        })).filter((review) => review.authorName && review.text && Number.isFinite(review.rating))
      : [];

    if (!Number.isFinite(place.rating) || !Number.isFinite(place.userRatingCount)) {
      console.error('Google Places API response did not include a valid rating and review count.');
      return res.status(502).json({ error: 'Google Reviews could not be loaded.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      rating: place.rating,
      reviewCount: place.userRatingCount,
      reviews,
    });
  } catch (error) {
    console.error('Google Places API request failed:', error);
    return res.status(502).json({ error: 'Google Reviews could not be loaded.' });
  }
};
