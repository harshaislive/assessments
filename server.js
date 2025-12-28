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
    const { email, name, answers } = req.body;
    console.log(`Submission from ${email}`);

    // Analysis Logic
    const idealAnswers = { 1: 'B', 2: 'C', 3: 'C', 4: 'B', 5: 'B', 6: 'B', 7: 'B' };
    let score = 0;
    const redFlags = [];

    // Check Answers
    for (const [qId, answer] of Object.entries(answers)) {
        if (idealAnswers[qId] === answer) {
            score++;
        }
    }

    // Red Flag Detection
    if (answers[6] === 'C' || answers[7] === 'C') redFlags.push("Hero Complex");
    if (answers[1] === 'A' || answers[2] === 'A' || answers[4] === 'D') redFlags.push("Silo Mentality");
    if (answers[3] === 'A' || answers[5] === 'C') redFlags.push("Credit Hog");
    if (answers[7] === 'A' || answers[7] === 'D') redFlags.push("Rigid Boundary Distortion");

    // Summary
    let summary = "Balanced / Neutral";
    if (score >= 6 && redFlags.length === 0) summary = "Ideal Team Player";
    else if (redFlags.length >= 2) summary = "High Risk";
    else if (redFlags.length === 1) summary = "Needs Coaching";

    const profileAnalysis = {
        score,
        maxScore: 7,
        redFlags: [...new Set(redFlags)], // unique
        summary
    };

    if (WEBHOOK_URL) {
        try {
            await axios.post(WEBHOOK_URL, {
                type: 'final_submission',
                timestamp: new Date().toISOString(),
                data: { 
                    email, 
                    name, 
                    answers, 
                    profileAnalysis 
                }
            });
        } catch (error) {
            console.error('Webhook error:', error.message);
        }
    }
    res.json({ success: true, profileAnalysis });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
