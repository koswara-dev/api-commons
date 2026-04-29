const { GoogleGenAI } = require('@google/genai');

async function generateArticle(title) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Bertindaklah sebagai pakar SEO dan penulis konten profesional. Buatlah artikel blog yang SEO-friendly berdasarkan judul: "${title}".

Instruksi Khusus:
1. **Struktur**: Gunakan hierarki heading yang benar (H2 dan H3).
2. **Konten**: Minimal 500 kata, informatif, dan mudah dibaca.
3. **Optimasi**: Gunakan kata kunci terkait secara natural di dalam paragraf.
4. **Format**: Kembalikan dalam format HTML murni (h2, h3, p, ul, li, strong).
5. **Elemen Tambahan**: Di bagian paling akhir artikel, tambahkan baris: 
   "META_DESCRIPTION: [Tuliskan meta description yang menarik maksimal 160 karakter]"
6. **Bahasa**: Bahasa Indonesia formal tapi santai (conversational).
7. **PENTING**: Jangan sertakan judul utama (H1) di dalam isi artikel, langsung mulai dari pendahuluan atau sub-judul (H2).

Judul Artikel: ${title}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error('Gemini Generation Error:', error);
    throw error;
  }
}

async function generateImage(title) {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Create a professional, high-quality blog post featured image for the topic: "${title}". 
  Style: Modern, minimalist, digital art style. High resolution.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: prompt,
    });

    // Cari part yang berisi inlineData (base64 image)
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data; // Mengembalikan base64 data
      }
    }

    return null;
  } catch (error) {
    console.error('Image Generation Error:', error);
    return null;
  }
}

async function evaluateArticle(title, content) {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Bertindaklah sebagai editor konten senior. Berikan skor kualitas untuk artikel berikut berdasarkan SEO, keterbacaan, dan relevansi terhadap judul "${title}".
  
  ARTIKEL:
  ${content}

  Berikan jawaban HANYA dalam format JSON mentah seperti ini:
  {"score": 85, "reason": "Penjelasan singkat"} `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Membersihkan Markdown jika ada (misal ```json)
    const cleanText = response.text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Evaluation Error:', error);
    return { score: 0, reason: 'Gagal melakukan evaluasi' };
  }
}

module.exports = { generateArticle, generateImage, evaluateArticle };
