require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Load Questions
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));

// Routes
app.get('/', (req, res) => {
    res.render('index', { questions });
});

app.get('/api/questions', (req, res) => {
    res.json(questions);
});

// Incremental Update
app.post('/api/update', async (req, res) => {
    const { email, name, questionId, answer, status } = req.body;
    console.log(`Update from ${email}: Q${questionId} = ${answer}`);
    
    if (WEBHOOK_URL) {
        try {
            await axios.post(WEBHOOK_URL, {
                type: 'update',
                timestamp: new Date().toISOString(),
                data: { email, name, questionId, answer, status }
            });
        } catch (error) {
            console.error('Webhook error:', error.message);
        }
    }
    res.sendStatus(200);
});

// Final Submission
app.post('/api/submit', async (req, res) => {
    const { email, name, answers, score, profile } = req.body;
    console.log(`Submission from ${email}`);

    if (WEBHOOK_URL) {
        try {
            await axios.post(WEBHOOK_URL, {
                type: 'final_submission',
                timestamp: new Date().toISOString(),
                data: { email, name, answers, score, profile }
            });
        } catch (error) {
            console.error('Webhook error:', error.message);
        }
    }
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
