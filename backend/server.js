require('dotenv').config();
apiKey: process.env.GROQ_API_KEY
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/analyze', async (req, res) => {
  try {
    const { prompt } = req.body;
    const message = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Always respond with only a valid JSON object. Never include any text outside the JSON.'
        },
        { role: 'user', content: prompt }
      ]
    });
    const content = message.choices[0].message.content;
    console.log("Groq response:\n", content);
    res.json({ content: [{ text: content }] });
  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Backend running on http://localhost:3001'));