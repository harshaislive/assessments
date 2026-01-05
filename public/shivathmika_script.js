let questions = [];
let currentQuestionIndex = 0;
let userProfile = { name: '', email: '' };
let answers = {}; // { questionId: { answer: label, justification: text } }
let timerInterval;
const TIME_LIMIT = 180; // Increased to 3 minutes per question for justification
let timeLeft = TIME_LIMIT;

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const assessmentScreen = document.getElementById('assessment-screen');
const completionScreen = document.getElementById('completion-screen');
const questionContainer = document.getElementById('question-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const qCurrentEl = document.getElementById('q-current');
const qTotalEl = document.getElementById('q-total');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Init Theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
});

// Modal Elements
const modalOverlay = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

// Custom Modal Function
function showModal(title, message, isConfirm = false) {
    return new Promise((resolve) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        if (isConfirm) {
            modalCancelBtn.style.display = 'inline-block';
            modalConfirmBtn.textContent = 'Confirm';
        } else {
            modalCancelBtn.style.display = 'none';
            modalConfirmBtn.textContent = 'Close';
        }

        modalOverlay.classList.remove('hidden');
        // Force reflow
        void modalOverlay.offsetWidth;
        modalOverlay.classList.add('active');

        const close = (result) => {
            modalOverlay.classList.remove('active');
            setTimeout(() => modalOverlay.classList.add('hidden'), 400);
            resolve(result);
        };

        modalConfirmBtn.onclick = () => close(true);
        modalCancelBtn.onclick = () => close(false);
    });
}

// Prevent Refresh Warning
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

// Incapable Button Handler - Keeping logic but might not be relevant for this specific role check
document.getElementById('incapable-btn').addEventListener('click', async () => {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    if (!name || !email) {
        await showModal("Required", "Please enter your name and email first.");
        return;
    }

    const confirmed = await showModal("Confirm Action", "Are you sure? This will end the assessment.", true);
    if(confirmed) {
        try {
            await fetch('/api/incapable', { // Reuse existing endpoint for simplicity or create specific one
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, testMode: window.isTestMode, context: 'shivathmika' })
            });
            await showModal("Recorded", "Assessment ended.");
            location.reload();
        } catch (err) {
            console.error(err);
        }
    }
});

// Init
document.getElementById('start-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    userProfile.name = document.getElementById('name').value;
    userProfile.email = document.getElementById('email').value;

    try {
        const res = await fetch('/api/shivathmika/questions');
        questions = await res.json();
        qTotalEl.textContent = String(questions.length).padStart(2, '0');
        
        startAssessment();
    } catch (err) {
        console.error('Failed to load questions', err);
        await showModal("Error", "Error loading assessment. Please try again.");
    }
});

function startAssessment() {
    welcomeScreen.classList.remove('active');
    setTimeout(() => {
        welcomeScreen.classList.add('hidden');
        assessmentScreen.classList.remove('hidden');
        setTimeout(() => assessmentScreen.classList.add('active'), 50);
        loadQuestion(0);
    }, 600);
}

function loadQuestion(index) {
    clearInterval(timerInterval);
    currentQuestionIndex = index;
    timeLeft = TIME_LIMIT;
    updateTimerDisplay();
    
    // Update UI
    qCurrentEl.textContent = String(index + 1).padStart(2, '0');
    
    // Lock Previous (Always strict mode for now)
    prevBtn.disabled = true;
    prevBtn.classList.add('locked');

    // Check existing answer
    const question = questions[index];
    const currentAnswerData = answers[question.id]; // object { answer, justification }

    // Validation for Next Button
    validateNextButton(currentAnswerData);
    
    nextBtn.querySelector('.btn-text').textContent = index === questions.length - 1 ? 'Finish Assessment' : 'Next Scenario';
    
    // Render Question
    const justificationValue = currentAnswerData ? currentAnswerData.justification : '';
    const selectedLabel = currentAnswerData ? currentAnswerData.answer : null;

    questionContainer.innerHTML = `
        <h2 class="question-text fade-in">${question.scenario}</h2>
        <div class="options-grid fade-in delay-1">
            ${question.options.map(opt => `
                <div class="option-card ${selectedLabel === opt.label ? 'selected' : ''}" onclick="selectOption('${opt.label}')">
                    <span class="option-label">${opt.label}</span>
                    <span class="option-text">${opt.text}</span>
                </div>
            `).join('')}
        </div>
        <div class="justification-area fade-in delay-2" style="margin-top: 2rem;">
            <label for="justification-${question.id}">Justification (Why did you choose this?):</label>
            <textarea 
                id="justification-${question.id}" 
                class="justification-input" 
                rows="4" 
                placeholder="Explain your reasoning comprehensively..."
                oninput="updateJustification(this.value)"
            >${justificationValue}</textarea>
        </div>
    `;

    // Start Timer
    startTimer();
    updateProgressBar();
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleNext(); // Auto-advance on timeout
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Visual urgency
    if (timeLeft < 30) timerEl.style.color = '#ff4d4d';
    else timerEl.style.color = 'var(--text-primary)';
}

function selectOption(label) {
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    // UI Selection
    const cardsArray = Array.from(cards);
    const targetCard = cardsArray.find(c => c.querySelector('.option-label').textContent === label);
    if(targetCard) targetCard.classList.add('selected');

    // Store Answer
    const qId = questions[currentQuestionIndex].id;
    if (!answers[qId]) answers[qId] = { justification: '' };
    answers[qId].answer = label;

    // Check validity
    validateNextButton(answers[qId]);
}

function updateJustification(text) {
    const qId = questions[currentQuestionIndex].id;
    if (!answers[qId]) answers[qId] = { answer: null };
    answers[qId].justification = text;

    // Check validity
    validateNextButton(answers[qId]);
}

function validateNextButton(answerData) {
    if (answerData && answerData.answer && answerData.justification && answerData.justification.trim().length > 10) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('locked');
    } else {
        nextBtn.disabled = true;
        nextBtn.classList.add('locked');
    }
}

function updateProgressBar() {
    const progress = ((currentQuestionIndex) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// Navigation
nextBtn.addEventListener('click', handleNext);

async function handleNext() {
    const qId = questions[currentQuestionIndex].id;
    const currentAns = answers[qId];

    // Send incremental update
    if (currentAns) {
        await sendUpdate(qId, currentAns, 'in_progress');
    }

    if (currentQuestionIndex < questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        await finishAssessment();
    }
}

async function sendUpdate(questionId, answerData, status) {
    await fetch('/api/shivathmika/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userProfile.email,
            name: userProfile.name,
            questionId,
            answer: answerData.answer,
            justification: answerData.justification,
            status,
            testMode: window.isTestMode
        })
    });
}

async function finishAssessment() {
    clearInterval(timerInterval);
    
    await fetch('/api/shivathmika/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userProfile.email,
            name: userProfile.name,
            answers,
            testMode: window.isTestMode
        })
    });

    assessmentScreen.classList.remove('active');
    setTimeout(() => {
        assessmentScreen.classList.add('hidden');
        completionScreen.classList.remove('hidden');
        setTimeout(() => completionScreen.classList.add('active'), 50);
    }, 600);
}
