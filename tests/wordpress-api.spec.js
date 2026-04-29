const { test, expect } = require('@playwright/test');

test.describe('WordPress REST API Testing', () => {
  const username = process.env.WP_USERNAME;
  const password = process.env.WP_APP_PASSWORD;
  
  // Basic Auth header
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  test('should authenticate and create a new post', async ({ request }) => {
    // 1. Create a Post
    const postData = {
      title: 'Testing Post from Playwright',
      content: 'This post was created using Playwright APIRequestContext.',
      status: 'publish', // Use 'draft' if you don't want it public
    };

    const response = await request.post('/index.php?rest_route=/wp/v2/posts', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      data: postData,
    });

    if (response.status() !== 201) {
      console.log('Error Status:', response.status());
      console.log('Error Body:', await response.text());
    }

    // Check if the request was successful (201 Created)
    expect(response.status()).toBe(201);
    
    const body = await response.json();
    console.log(`Post Created ID: ${body.id}`);
    console.log(`Post Link: ${body.link}`);

    // Verify post properties
    expect(body.title.rendered).toBe(postData.title);
    expect(body.status).toBe('publish');

    // 2. Fetch the created post to verify persistence
    const getResponse = await request.get(`/index.php?rest_route=/wp/v2/posts/${body.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const getBody = await getResponse.json();
    expect(getBody.id).toBe(body.id);
  });

  test('should fail with invalid credentials', async ({ request }) => {
    const invalidAuth = `Basic ${Buffer.from('wrong:creds').toString('base64')}`;
    
    const response = await request.post('/index.php?rest_route=/wp/v2/posts', {
      headers: {
        'Authorization': invalidAuth,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'Unauthorized Post',
        content: 'Should fail',
      },
    });

    if (response.status() !== 401) {
      console.log('Unauthorized Test - Expected 401, got:', response.status());
      console.log('Unauthorized Test - Body:', await response.text());
    }

    // WordPress usually returns 401 for bad auth
    expect(response.status()).toBe(401);
  });
});
