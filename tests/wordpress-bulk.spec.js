const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { generateArticle, generateImage } = require('../utils/gemini');

const dayjs = require('dayjs');

test.describe('WordPress Bulk Content Generation and Posting', () => {
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

  async function uploadMedia(request, base64Data, title) {
    if (!base64Data) return null;
    
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `featured-${Date.now()}.png`;

    const response = await request.post('/index.php?rest_route=/wp/v2/media', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: buffer,
    });

    if (response.status() !== 201) {
      console.error('Media Upload Error:', response.status(), await response.text());
      return null;
    }

    const body = await response.json();
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
    test(`should generate and post article: ${record.title}`, async ({ request }) => {
      test.setTimeout(240000); // Set timeout to 4 minutes (240 seconds)

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

      // 2. Generate Content and Image using Gemini
      console.log(`Generating content and image...`);
      const [articleContentRaw, imageBase64] = await Promise.all([
        generateArticle(record.title),
        generateImage(record.title)
      ]);

      let articleContent = articleContentRaw;
      
      // Extract meta description if exists and clean content
      const metaMatch = articleContent.match(/META_DESCRIPTION:\s*(.*)/i);
      const metaDescription = metaMatch ? metaMatch[1] : '';
      articleContent = articleContent.replace(/META_DESCRIPTION:\s*(.*)/i, '').trim();
      
      // Remove leading H1 if exists (safety check)
      articleContent = articleContent.replace(/^<h1[^>]*>.*?<\/h1>/i, '').trim();
      articleContent = articleContent.replace(/^#\s+.*$/m, '').trim(); // Remove Markdown style H1 if exists

      // 3. Upload Featured Image
      console.log(`Uploading featured image...`);
      const featuredMediaId = await uploadMedia(request, imageBase64, record.title);

      // 4. Post to WordPress
      const postData = {
        title: record.title,
        content: articleContent,
        status: 'publish',
        // Jika tanggal hari ini, biarkan WordPress menggunakan waktu sekarang (omit date).
        // Jika tidak, gunakan jam 9 pagi pada tanggal tersebut.
        date: isToday ? undefined : dayjs(record.posting_date).set('hour', 9).set('minute', 0).toISOString(),
        excerpt: metaDescription, // Masukkan meta description ke dalam excerpt WordPress
        categories: categoryIds, // Assign category IDs
        featured_media: featuredMediaId, // Set the uploaded image as featured
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
      console.log(`Is Today: ${isToday}`);
      console.log(`Successfully posted: ${body.link}`);
    });
  }
});
