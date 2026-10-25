require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/', (req, res) => res.send('Resume screening backend is running'));

app.post('/analyze', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const message = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0,
      max_completion_tokens: 4096,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Always respond with only a valid JSON object. Never include any text outside the JSON.'
        },
        { role: 'user', content: prompt }
      ]
    });

    const content = message.choices[0].message.content;
    console.log('Groq response:\n', content);
    res.json({ content: [{ text: content }] });
  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));