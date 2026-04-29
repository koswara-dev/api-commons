const { test, expect } = require('@playwright/test');

test.describe('WordPress Category API Testing', () => {
  const username = process.env.WP_USERNAME;
  const password = process.env.WP_APP_PASSWORD;
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  test('should create a new category', async ({ request }) => {
    const categoryName = 'Programming ' + Date.now();
    
    const response = await request.post('/index.php?rest_route=/wp/v2/categories', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      data: {
        name: categoryName,
        description: 'Kategori untuk artikel pemrograman.',
      },
    });

    if (response.status() !== 201) {
      console.log('Error Body:', await response.text());
    }

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.name).toBe(categoryName);
    console.log(`Category Created: ${body.name} (ID: ${body.id})`);
  });

  test('should list all categories', async ({ request }) => {
    const response = await request.get('/index.php?rest_route=/wp/v2/categories', {
      headers: {
        'Authorization': authHeader,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    console.log(`Found ${body.length} categories.`);
  });
});
