const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { generateArticle } = require('../utils/gemini');

const dayjs = require('dayjs');

test.describe('WordPress Bulk Content with Local Image Upload', () => {
  const username = process.env.WP_USERNAME;
  const password = process.env.WP_APP_PASSWORD;
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  async function getOrCreateCategory(request, categoryName) {
    if (!categoryName) return [];
    
    // 1. Search for existing category
    const searchResponse = await request.get(`/index.php?rest_route=/wp/v2/categories&search=${encodeURIComponent(categoryName)}`, {
      headers: { 'Authorization': authHeader }
    });
    
    const categories = await searchResponse.json();
    const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    
    if (existing) return [existing.id];

    // 2. Create if not exists
    const createResponse = await request.post('/index.php?rest_route=/wp/v2/categories', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      data: { name: categoryName }
    });

    const newCategory = await createResponse.json();
    return [newCategory.id];
  }

  async function uploadMediaFromFile(request, filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return null;
    }
    
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    const response = await request.post('/index.php?rest_route=/wp/v2/media', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      data: buffer, // Gunakan 'data' untuk Playwright, bukan 'body'
    });

    if (response.status() !== 201) {
      console.error('Media Upload Error:', response.status());
      console.error('Error Detail:', await response.text());
      return null;
    }

    const body = await response.json();
    console.log(`Media Uploaded Successfully! ID: ${body.id}`);
    return body.id;
  }

  // Read CSV data
  const csvFilePath = path.join(__dirname, '../articles.csv');
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  for (const record of records) {
    test(`should generate and post article with local image: ${record.title}`, async ({ request }) => {
      test.setTimeout(120000); // 2 menit cukup karena tidak generate gambar

      const today = dayjs().format('YYYY-MM-DD');
      const isToday = record.posting_date === today;

      if (!isToday) {
        console.log(`Skipping: ${record.title} (Scheduled for ${record.posting_date})`);
        test.skip();
        return;
      }

      console.log(`Processing: ${record.title} [Category: ${record.kategori}]`);
      
      // 1. Ensure Category exists and get ID
      const categoryIds = await getOrCreateCategory(request, record.kategori);

      // 2. Generate Content using Gemini
      console.log(`Generating content for today's article...`);
      let articleContent = await generateArticle(record.title);
      
      // Extract meta description if exists and clean content
      const metaMatch = articleContent.match(/META_DESCRIPTION:\s*(.*)/i);
      const metaDescription = metaMatch ? metaMatch[1] : '';
      articleContent = articleContent.replace(/META_DESCRIPTION:\s*(.*)/i, '').trim();
      
      // Remove leading H1 if exists (safety check)
      articleContent = articleContent.replace(/^<h1[^>]*>.*?<\/h1>/i, '').trim();
      articleContent = articleContent.replace(/^#\s+.*$/m, '').trim();

      // 3. Find and Upload Local Featured Image
      const imagePath = path.join(__dirname, `../images/${record.posting_date}.png`);
      console.log(`Checking for image at: ${imagePath}`);
      const featuredMediaId = await uploadMediaFromFile(request, imagePath);

      // 4. Post to WordPress
      const postData = {
        title: record.title,
        content: articleContent,
        status: 'publish',
        date: isToday ? undefined : dayjs(record.posting_date).set('hour', 9).set('minute', 0).toISOString(),
        excerpt: metaDescription,
        categories: categoryIds,
        featured_media: featuredMediaId,
      };

      console.log(`Posting to WordPress... ${isToday ? '(Publish Now)' : '(Scheduled)'}`);
      const response = await request.post('/index.php?rest_route=/wp/v2/posts', {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        data: postData,
      });

      if (response.status() !== 201) {
        console.error('WordPress Error Status:', response.status());
        console.error('WordPress Error Body:', await response.text());
      }

      expect(response.status()).toBe(201);
      const body = await response.json();
      console.log(`Successfully posted: ${body.link}`);
    });
  }
});
