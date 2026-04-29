const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { generateArticle, evaluateArticle } = require('../utils/gemini');

const dayjs = require('dayjs');

test.describe('WordPress Bulk Content with AI Quality Scoring', () => {
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
      test.setTimeout(300000); // Set timeout to 5 minutes for retries

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

      let articleContent = '';
      let metaDescription = '';
      let isQualityPassed = false;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`Attempt ${attempt}: Generating content...`);
        
        // 2. Generate Content using Gemini
        let rawContent = await generateArticle(record.title);
        
        // Extract meta description and clean
        const metaMatch = rawContent.match(/META_DESCRIPTION:\s*(.*)/i);
        const currentMeta = metaMatch ? metaMatch[1] : '';
        let cleanedContent = rawContent.replace(/META_DESCRIPTION:\s*(.*)/i, '').trim();
        cleanedContent = cleanedContent.replace(/^<h1[^>]*>.*?<\/h1>/i, '').trim();
        cleanedContent = cleanedContent.replace(/^#\s+.*$/m, '').trim();

        // 3. AI Quality Scoring
        console.log(`Evaluating quality for attempt ${attempt}...`);
        const evaluation = await evaluateArticle(record.title, cleanedContent);
        console.log(`Score: ${evaluation.score}/100 - ${evaluation.reason}`);

        if (evaluation.score > 95) {
          articleContent = cleanedContent;
          metaDescription = currentMeta;
          isQualityPassed = true;
          break;
        } else {
          console.warn(`Quality too low (${evaluation.score}). Retrying...`);
        }
      }

      if (!isQualityPassed) {
        console.error(`Failed to reach quality threshold after ${MAX_RETRIES} attempts. Skipping.`);
        test.skip();
        return;
      }

      // 4. Find and Upload Local Featured Image
      const imagePath = path.join(__dirname, `../images/${record.posting_date}.png`);
      console.log(`Checking for image at: ${imagePath}`);
      const featuredMediaId = await uploadMediaFromFile(request, imagePath);

      // 5. Post to WordPress
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
