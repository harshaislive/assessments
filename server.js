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

app.get('/preview-end', (req, res) => {
    res.render('preview', { questions: [] });
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

// Incapable Declaration
app.post('/api/incapable', async (req, res) => {
    const { email, name } = req.body;
    console.log(`Incapable declaration from ${email}`);

    if (WEBHOOK_URL) {
        try {
            await axios.post(WEBHOOK_URL, {
                type: 'incapable_declaration',
                timestamp: new Date().toISOString(),
                data: { email, name, status: 'gave_up' }
            });
        } catch (error) {
            console.error('Webhook error:', error.message);
        }
    }
    res.json({ success: true });
});

// Final Submission
app.post('/api/submit', async (req, res) => {
    const { email, name, answers } = req.body;
    console.log(`Submission from ${email}`);

    // Analysis Logic
    const idealAnswers = { 
        1: 'B', 2: 'C', 3: 'C', 4: 'B', 5: 'B', 6: 'B', 7: 'B',
        8: 'B', 9: 'B', 10: 'B', 11: 'B', 12: 'B', 13: 'B', 14: 'B', 
        15: 'B', 16: 'B', 17: 'B', 18: 'B', 19: 'B', 20: 'B'
    };
    let score = 0;
    const redFlags = [];
    const finalAnswers = { ...answers };

    // Check all questions for missing answers (Time outs)
    for (let i = 1; i <= 20; i++) {
        const answer = finalAnswers[i];
        if (!answer) {
            finalAnswers[i] = "No Answer (Time Up)";
        } else if (idealAnswers[i] === answer) {
            score++;
        }
    }

    // Red Flag Detection (Expanded)
    const checkFlag = (q, a, flag) => { if(finalAnswers[q] === a) redFlags.push(flag); };

    // Hero Complex
    checkFlag(6, 'C', "Hero Complex");
    checkFlag(7, 'C', "Hero Complex");
    checkFlag(10, 'A', "Hero Complex");
    checkFlag(18, 'A', "Hero Complex");

    // Silo Mentality
    checkFlag(1, 'A', "Silo Mentality");
    checkFlag(2, 'A', "Silo Mentality");
    checkFlag(4, 'D', "Silo Mentality");
    checkFlag(8, 'A', "Silo Mentality");
    checkFlag(15, 'A', "Silo Mentality");

    // Credit Hog
    checkFlag(3, 'A', "Credit Hog");
    checkFlag(5, 'C', "Credit Hog");
    checkFlag(10, 'D', "Credit Hog");
    checkFlag(14, 'D', "Credit Hog");
    checkFlag(19, 'A', "Credit Hog");

    // Rigid Boundary / Toxic
    checkFlag(7, 'A', "Rigid Boundary");
    checkFlag(7, 'D', "Rigid Boundary");
    checkFlag(9, 'C', "Toxic Behavior");
    checkFlag(9, 'D', "Toxic Behavior");
    checkFlag(11, 'A', "Toxic Behavior");
    checkFlag(13, 'A', "Toxic Behavior");
    checkFlag(14, 'A', "Toxic Behavior");

    // Summary
    let summary = "Balanced / Neutral";
    const flagCount = new Set(redFlags).size;
    
    if (score >= 17 && flagCount === 0) summary = "Ideal Team Player";
    else if (flagCount >= 3) summary = "High Risk";
    else if (flagCount >= 1 || score < 10) summary = "Needs Coaching";

    const profileAnalysis = {
        score,
        maxScore: 20,
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
                    answers: finalAnswers, 
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
